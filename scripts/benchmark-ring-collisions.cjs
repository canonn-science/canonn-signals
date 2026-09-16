/**
 * CPU-only benchmark for Musca Dark Region SO-Q b5-5 bodies 1 + 2 and their rings.
 * Uses the observed orbital values in orbital-relations.ring-collision.spec.ts and
 * a fixed epoch, not live API data. No browser or worker/serialization overhead.
 *
 * Current checkout: node scripts/benchmark-ring-collisions.cjs
 * Compare revision: node scripts/benchmark-ring-collisions.cjs <git-revision>
 * Compare windowFingerprint as well as timing; run on the same otherwise-idle machine.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const ts = require('typescript');

const repo = path.resolve(__dirname, '..');
const revision = process.argv[2];
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'musca-benchmark-'));
const epoch = '2026-08-17T19:39:35Z';

function body(name, parent, data) {
  const node = {
    bodyData: { bodyId: 0, name, id64: 0n, subType: '', type: 'Planet', ...data },
    parent, subBodies: [],
  };
  parent?.subBodies.push(node);
  return node;
}

function muscaPair() {
  const root = body('Barycentre', null, { type: 'Barycentre' });
  const common = {
    orbitalEccentricity: 0.198392, orbitalInclination: -4.164512,
    ascendingNode: -100.3383, meanAnomaly: 233.703906,
    orbitalPeriod: 0.283064148217593, timestamps: { meanAnomaly: epoch },
  };
  const first = body('1', root, {
    ...common, semiMajorAxis: 0.0000468578213261962,
    argOfPeriapsis: 173.768076, radius: 5610.1045,
  });
  const second = body('2', root, {
    ...common, semiMajorAxis: 0.0000823957132312579,
    argOfPeriapsis: 353.76807, radius: 4723.183,
  });
  body('A Ring', first, { type: 'Ring', innerRadius: 8452, outerRadius: 8454.4 });
  body('A Ring', second, { type: 'Ring', innerRadius: 7104, outerRadius: 7123.8 });
  return root;
}

try {
  // Compile only the framework-free engine and its two runtime dependencies.
  for (const name of ['orbital-relations.core', 'collision-request', 'body-types']) {
    const filename = `src/app/data/${name}.ts`;
    const source = revision
      ? execFileSync('git', ['show', `${revision}:${filename}`], { cwd: repo, encoding: 'utf8' })
      : fs.readFileSync(path.join(repo, filename), 'utf8');
    const { outputText } = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    });
    fs.writeFileSync(path.join(temporary, `${name}.js`), outputText);
  }
  const { OrbitalRelationsCore } = require(path.join(temporary, 'orbital-relations.core.js'));
  const core = new OrbitalRelationsCore();
  const root = muscaPair();
  const times = [];
  let statuses;
  for (let iteration = 0; iteration < 9; iteration++) {
    const start = performance.now();
    statuses = core.detectRingCollisionStatuses(root, Date.parse(epoch));
    if (iteration >= 2) { times.push(performance.now() - start); }
  }
  times.sort((a, b) => a - b);
  const windows = statuses.map(status => ({
    candidate: status.isCandidate,
    partner: status.partner,
    windows: status.upcomingCollisions.map(window => ({
      start: window.start, end: window.end,
      minSeparationKm: window.minSeparationKm, minSeparationAt: window.minSeparationAt,
    })),
  }));
  console.log(JSON.stringify({
    revision: revision ?? 'working tree', epoch,
    medianMs: times[3], minMs: times[0], maxMs: times[6],
    windowCounts: statuses.map(status => status.upcomingCollisions.length),
    windowFingerprint: createHash('sha256').update(JSON.stringify(windows)).digest('hex'),
  }, null, 2));
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}
