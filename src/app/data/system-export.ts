import { CanonnBiostats, CanonnBiostatsBody, SystemBody } from '../home/home.component';
import { BODY_TYPE } from './body-types';
import { BodyEnrichmentService, CalculatedValues } from './body-enrichment.service';
import { formatBodyJson } from '../dialogs/json-dialog/format-body-json';

/** A raw Spansh ring/belt object with the derived values attached under `calculated`. */
type RingOrBeltWithCalculated<T> = T & { calculated: CalculatedValues };

/**
 * A raw Spansh body enriched for export: every field of the original body is preserved, plus a
 * `calculated` block, and each ring/belt gains its own `calculated` block. Downstream Spansh
 * consumers can ignore the added `calculated` keys entirely.
 */
export type ExportBody = Omit<CanonnBiostatsBody, 'rings' | 'belts'> & {
  calculated: CalculatedValues;
  rings?: RingOrBeltWithCalculated<NonNullable<CanonnBiostatsBody['rings']>[number]>[];
  belts?: RingOrBeltWithCalculated<NonNullable<CanonnBiostatsBody['belts']>[number]>[];
};

/**
 * Full-system export: the exact Spansh dump shape (`{ system: { …, bodies: [] } }`) with each
 * body enriched, plus a sibling `_generated` metadata block. The `_generated` key sits outside
 * `system`, so a consumer that reads Spansh dumps (which only look at `.system`) is unaffected.
 */
export interface SystemExport {
  system: Omit<CanonnBiostats['system'], 'bodies'> & { bodies: ExportBody[] };
  _generated: {
    /** ISO-8601 instant the export was produced (the epoch its time-dependent values use). */
    generatedAt: string;
    /** Identifies the tool that produced the file. */
    generator: string;
    /** Human-readable note describing the added `calculated` fields. */
    note: string;
  };
}

/** Builds a bodyId → tree-node map from the root bodies, so each raw body can find its context. */
function indexByBodyId(roots: SystemBody[]): Map<number, SystemBody> {
  const map = new Map<number, SystemBody>();
  const walk = (node: SystemBody): void => {
    // Synthesized ring/belt nodes carry bodyId -1; only real bodies have unique ids worth indexing.
    if (node.bodyData.bodyId >= 0) { map.set(node.bodyData.bodyId, node); }
    for (const child of node.subBodies) { walk(child); }
  };
  roots.forEach(walk);
  return map;
}

/**
 * Wraps a raw ring/belt (radii in metres) as a SystemBody with radii in km and its real parent,
 * mirroring the tree synthesis in HomeComponent so ring dynamics / Roche limits match the UI.
 */
function ringBeltWrapper(
  raw: { name: string; innerRadius: number; outerRadius: number; mass: number; type: string; id64?: bigint },
  type: typeof BODY_TYPE.Ring | typeof BODY_TYPE.Belt,
  parent: SystemBody | null,
): SystemBody {
  return {
    bodyData: {
      bodyId: -1,
      name: raw.name,
      id64: raw.id64 ?? 0n,
      subType: raw.type,
      type,
      innerRadius: raw.innerRadius / 1000,
      outerRadius: raw.outerRadius / 1000,
      mass: raw.mass,
    },
    subBodies: [],
    parent,
  };
}

/**
 * Reconstructs the full-system Spansh dump with every body (and every ring/belt) enriched with
 * calculated values. Pure: `now` (epoch ms) fixes the instant that time-dependent values are
 * computed against, so the output is reproducible.
 *
 * @param data   The loaded system (raw Spansh shape).
 * @param roots  The root bodies of the built SystemBody tree (provides parent/sibling context).
 * @param enrich The enrichment service (single source of truth for the calculated values).
 * @param now    Epoch ms fixing the reproducible instant for time-dependent values.
 */
export function buildSystemExport(
  data: CanonnBiostats,
  roots: SystemBody[],
  enrich: BodyEnrichmentService,
  now: number,
): SystemExport {
  const nodesById = indexByBodyId(roots);

  const bodies: ExportBody[] = data.system.bodies.map(raw => {
    // Prefer the built tree node (carries parent/sibling context); fall back to a context-free
    // wrapper if the tree somehow lacks it, so no body is dropped from the export.
    const node = nodesById.get(raw.bodyId) ?? { bodyData: raw, subBodies: [], parent: null };

    // Pull rings/belts out of the spread so the raw (un-enriched) arrays don't clash with the
    // enriched element type; they are re-added below with their own `calculated` blocks.
    const { rings, belts, ...rest } = raw;
    const exportBody: ExportBody = {
      ...rest,
      calculated: enrich.computeCalculatedValues(node, now),
    };

    if (rings) {
      exportBody.rings = rings.map(ring => ({
        ...ring,
        calculated: enrich.computeCalculatedValues(ringBeltWrapper(ring, BODY_TYPE.Ring, node), now),
      }));
    }
    if (belts) {
      exportBody.belts = belts.map(belt => ({
        ...belt,
        calculated: enrich.computeCalculatedValues(ringBeltWrapper(belt, BODY_TYPE.Belt, node), now),
      }));
    }

    return exportBody;
  });

  return {
    system: { ...data.system, bodies },
    _generated: {
      generatedAt: new Date(now).toISOString(),
      generator: 'canonn-signals',
      note: 'Each body (and ring/belt) carries a `calculated` block of values derived from the raw '
        + 'Spansh data. Raw Spansh fields are unchanged; consumers may ignore `calculated` and `_generated`.',
    },
  };
}

/** Serializes a system export to pretty JSON (BigInt ids rendered as decimal strings). */
export function serializeSystemExport(exportData: SystemExport): string {
  return formatBodyJson(exportData);
}

/** Safe-ish filename for a system export, e.g. "Col 285 Sector AB-1" → "Col-285-Sector-AB-1.json". */
export function systemExportFilename(systemName: string): string {
  const slug = systemName.trim().replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '') || 'system';
  return `${slug}.json`;
}

/**
 * Triggers a browser download of `text` as `filename`. Isolated here (rather than inline in the
 * component) so the pure builder above stays DOM-free and unit-testable.
 */
export function downloadJson(filename: string, text: string): void {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
