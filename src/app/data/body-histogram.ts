import { BODY_TYPE } from './body-types';

/**
 * Minimal structural shape the histogram needs from a body. Deliberately a subset of
 * `CanonnBiostatsBody` so the helper stays framework-free and unit-testable without
 * pulling in the (large) home-component interface or the API client.
 */
export interface HistogramBodyInput {
  type?: string;
  subType?: string;
}

/** Top-level grouping used to colour and order the bars. */
export type BodyKind = 'Star' | 'Planet' | 'Other';

export interface HistogramBar {
  /** Display label — the body's sub-type (e.g. "High metal content world"). */
  label: string;
  /** Number of bodies in the system matching this label. */
  count: number;
  /** Coarse kind, used for bar colour and grouping order. */
  kind: BodyKind;
}

export interface BodyHistogram {
  /** Bars sorted stars-first, then planets, each group descending by count. */
  bars: HistogramBar[];
  /** Total number of bodies counted (sum of all bar counts). */
  total: number;
  /** Largest single bar count, for scaling bar widths (0 when empty). */
  maxCount: number;
}

/** Stars sort before planets before everything else. */
const KIND_ORDER: Record<BodyKind, number> = { Star: 0, Planet: 1, Other: 2 };

function kindOf(type: string | undefined): BodyKind {
  if (type === BODY_TYPE.Star) return 'Star';
  if (type === BODY_TYPE.Planet) return 'Planet';
  return 'Other';
}

function labelOf(body: HistogramBodyInput): string {
  const subType = body.subType?.trim();
  if (subType) return subType;
  const type = body.type?.trim();
  return type || 'Unknown';
}

/**
 * Builds a "histogram of bodies": a count of each body sub-type in a system, grouped by
 * kind so stars and planets read as distinct bands. Belts, rings and synthetic barycentres
 * are excluded (the same way the system-completeness count excludes them) so the totals
 * match what a CMDR would scan in-game. Passing `system.bodies` yields one bar per
 * stellar/planetary sub-type.
 */
export function buildBodyHistogram(bodies: readonly HistogramBodyInput[]): BodyHistogram {
  const byLabel = new Map<string, HistogramBar>();

  for (const body of bodies) {
    // Skip non-bodies the same way the system-completeness count does: belts, rings,
    // and synthetic barycentres are orbital features/reference points, not scannable
    // bodies, so the histogram total stays consistent with "N bodies known".
    if (
      body.type === BODY_TYPE.Belt ||
      body.type === BODY_TYPE.Ring ||
      body.type === BODY_TYPE.Barycentre
    ) {
      continue;
    }
    const label = labelOf(body);
    const existing = byLabel.get(label);
    if (existing) {
      existing.count += 1;
    } else {
      byLabel.set(label, { label, count: 1, kind: kindOf(body.type) });
    }
  }

  const bars = Array.from(byLabel.values()).sort((a, b) => {
    if (a.kind !== b.kind) return KIND_ORDER[a.kind] - KIND_ORDER[b.kind];
    if (a.count !== b.count) return b.count - a.count;
    return a.label.localeCompare(b.label);
  });

  const total = bars.reduce((sum, bar) => sum + bar.count, 0);
  const maxCount = bars.reduce((max, bar) => Math.max(max, bar.count), 0);

  return { bars, total, maxCount };
}
