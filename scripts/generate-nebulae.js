const fs = require('fs');
const path = require('path');
const https = require('https');

// Source CSV published by EDAstro (CMDR Orvidius). Columns:
//   Name,System,X,Y,Z,Type,RegionID
// We convert it ONCE into a JSON asset the app fetches lazily; the app never
// consumes the CSV directly. (The dataset is ~600KB, so it's an on-demand asset
// rather than a TS module bundled into the initial chunk.)
const DEFAULT_SOURCE = 'https://edastro.com/mapcharts/files/nebulae-coordinates.csv';
const dest = path.resolve(__dirname, '../src/assets/nebulae.json');

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

function parseCsv(csv) {
  const lines = csv.replace(/^﻿/, '').replace(/\r\n/g, '\n').split('\n').filter(l => l.trim().length > 0);
  // Drop the header row (Name,System,X,Y,Z,Type,RegionID).
  const rows = lines.slice(1);
  const nebulae = [];
  for (const line of rows) {
    const [name, system, x, y, z, type] = parseCsvLine(line);
    const nx = Number(x), ny = Number(y), nz = Number(z);
    if (!name || Number.isNaN(nx) || Number.isNaN(ny) || Number.isNaN(nz)) {
      continue; // skip malformed rows
    }
    nebulae.push({ name: name.trim(), system: (system || '').trim(), x: nx, y: ny, z: nz, type: (type || '').trim() });
  }
  return nebulae;
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
    // Don't hang the build/maintenance run forever on a dead or stalled connection.
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
  const csv = await loadSource(source);
  const nebulae = parseCsv(csv);
  if (nebulae.length === 0) {
    throw new Error('No nebulae parsed from source; aborting.');
  }

  // Emit one compact object per line so the generated asset stays diff-friendly.
  const entries = nebulae
    .map(n => `  {"name":${JSON.stringify(n.name)},"system":${JSON.stringify(n.system)},"x":${n.x},"y":${n.y},"z":${n.z},"type":${JSON.stringify(n.type)}}`)
    .join(',\n');

  const output = `[\n${entries}\n]\n`;

  fs.writeFileSync(dest, output);
  console.log(`Wrote ${nebulae.length} nebulae to ${path.relative(path.resolve(__dirname, '..'), dest)}`);
}

main().catch(err => {
  console.error(err.message || err);
  process.exit(1);
});
