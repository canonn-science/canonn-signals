const fs = require('fs');
const path = require('path');
const https = require('https');

// Source CSV published by EDAstro (CMDR Orvidius): the EDSM points-of-interest
// catalogue. Columns:
//   POI Type,ID,Name,X,Y,Z,Reference System,Notes
// We keep only the Green Gas Giants (POI Type "GGG") and convert them ONCE, at
// build time, into a small TypeScript module the app can import directly. The
// app never consumes the CSV.
const DEFAULT_SOURCE = 'https://edastro.com/mapcharts/files/edsmPOI.csv';
const dest = path.resolve(__dirname, '../src/app/data/green-gas-giants.generated.ts');

const POI_TYPE_GGG = 'GGG';

/** Reads a single CSV record, honouring double-quoted fields with embedded commas/quotes. */
function parseCsvLine(line) {
  const fields = [];
  let field = '';
  let inQuotes = false;
  // True only at the very start of a field, where a `"` opens a quoted field. A `"`
  // anywhere else in an unquoted field is a literal character (RFC 4180), so a stray
  // mid-field quote can't flip us into quote mode and swallow the rest of the line.
  let atFieldStart = true;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { field += '"'; i++; } // escaped quote
        else { inQuotes = false; }
      } else {
        field += ch;
      }
    } else if (ch === '"' && atFieldStart) {
      inQuotes = true;
      atFieldStart = false;
    } else if (ch === ',') {
      fields.push(field);
      field = '';
      atFieldStart = true;
    } else {
      field += ch;
      atFieldStart = false;
    }
  }
  fields.push(field);
  return fields;
}

/**
 * Parses the POI CSV and returns the Green Gas Giants as `{ system, body }`:
 *   - `system` is the Reference System column, trimmed.
 *   - `body` is the Name column with everything from the first ":" onward removed
 *     (that suffix is the discoverer's free-text label), then trimmed.
 */
function parseGreenGasGiants(csv) {
  const lines = csv.replace(/^﻿/, '').replace(/\r\n/g, '\n').split('\n').filter(l => l.trim().length > 0);
  const header = parseCsvLine(lines[0]).map(h => h.trim());
  const typeIdx = header.indexOf('POI Type');
  const nameIdx = header.indexOf('Name');
  const systemIdx = header.indexOf('Reference System');
  if (typeIdx < 0 || nameIdx < 0 || systemIdx < 0) {
    throw new Error(`Unexpected CSV header: ${header.join(',')}`);
  }

  const giants = [];
  for (const line of lines.slice(1)) {
    const fields = parseCsvLine(line);
    if ((fields[typeIdx] || '').trim() !== POI_TYPE_GGG) {
      continue;
    }
    const system = (fields[systemIdx] || '').trim();
    const body = (fields[nameIdx] || '').split(':')[0].trim();
    if (!system || !body) {
      continue; // skip rows missing the system or body name
    }
    giants.push({ system, body });
  }
  return giants;
}

function fetchUrl(url, redirectsLeft = 5) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, res => {
      const status = res.statusCode ?? 0;
      // Follow redirects (the asset may move behind a CDN/redirect over time).
      if (status >= 300 && status < 400 && res.headers.location) {
        res.resume(); // drain so the socket can be reused
        if (redirectsLeft <= 0) {
          reject(new Error(`Too many redirects fetching ${url}`));
          return;
        }
        const next = new URL(res.headers.location, url).toString();
        resolve(fetchUrl(next, redirectsLeft - 1));
        return;
      }
      if (status !== 200) {
        reject(new Error(`HTTP ${status} fetching ${url}`));
        res.resume();
        return;
      }
      let body = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => resolve(body));
    });
    request.on('error', reject);
    // Don't hang the build forever on a dead or stalled connection.
    request.setTimeout(60000, () => request.destroy(new Error(`Timed out fetching ${url}`)));
  });
}

async function loadSource(source) {
  if (/^https?:\/\//i.test(source)) {
    return fetchUrl(source);
  }
  return fs.readFileSync(source, 'utf8');
}

async function main() {
  const source = process.argv[2] || DEFAULT_SOURCE;

  let csv;
  try {
    csv = await loadSource(source);
  } catch (err) {
    // This runs on every production build (prebuild), so a transient edastro
    // outage, an offline CI runner, or a timeout must not break the build when a
    // previously-generated module is already committed. Keep the existing file and
    // warn; only hard-fail if there's nothing to fall back to.
    if (fs.existsSync(dest)) {
      console.warn(`Warning: could not fetch ${source} (${err.message || err}); keeping existing ${path.relative(path.resolve(__dirname, '..'), dest)}.`);
      return;
    }
    throw err;
  }

  const giants = parseGreenGasGiants(csv);
  if (giants.length === 0) {
    throw new Error('No Green Gas Giants parsed from source; aborting.');
  }

  // Emit one compact object per line so the generated module stays diff-friendly.
  const entries = giants
    .map(g => `  { system: ${JSON.stringify(g.system)}, body: ${JSON.stringify(g.body)} },`)
    .join('\n');

  const output = `// AUTO-GENERATED by scripts/generate-green-gas-giants.js from EDAstro's edsmPOI.csv.
// Do not edit by hand; run \`npm run generate-green-gas-giants\` (also runs on prebuild).
export interface GreenGasGiant {
  /** The in-game system the Green Gas Giant sits in (CSV "Reference System"). */
  system: string;
  /** The body name (CSV "Name" with the free-text suffix after ":" stripped). */
  body: string;
}

export const GREEN_GAS_GIANTS: readonly GreenGasGiant[] = [
${entries}
];
`;

  fs.writeFileSync(dest, output);
  console.log(`Wrote ${giants.length} Green Gas Giants to ${path.relative(path.resolve(__dirname, '..'), dest)}`);
}

main().catch(err => {
  console.error(err.message || err);
  process.exit(1);
});
