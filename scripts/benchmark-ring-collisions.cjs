/**
 * CPU-only benchmarks for Musca Dark Region SO-Q b5-5 and Eoch Flyuae KS-V b18-2.
 * Uses the observed orbital values in orbital-relations.ring-collision.spec.ts and
 * a fixed epoch, not live API data. No browser or worker/serialization overhead.
 *
 * Current checkout: node scripts/benchmark-ring-collisions.cjs
 * Compare revision: node scripts/benchmark-ring-collisions.cjs <git-revision>
 * Body-6 planetary collisions: add --system=swoiwns.
 * Nested moon/ring pair: add --system=eoch to either command above.
 * Compare windowFingerprint as well as timing; run on the same otherwise-idle machine.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const ts = require('typescript');

const repo = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const system = args.includes('--system=swoiwns') ? 'swoiwns' : args.includes('--system=eoch') ? 'eoch' : 'musca';
const revision = args.find(arg => !arg.startsWith('--'));
if (args.some(arg => arg.startsWith('--') && !['--system=eoch', '--system=musca', '--system=swoiwns'].includes(arg))) {
  throw new Error('Supported systems: --system=musca or --system=eoch or --system=swoiwns');
}
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'ring-benchmark-'));
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

function eochPair() {
  const root = body('Barycentre', null, { type: 'Barycentre' });
  const common = {
    orbitalEccentricity: 0.0869, orbitalInclination: -3.691517,
    ascendingNode: -16.844281, meanAnomaly: 46.56284,
    orbitalPeriod: 0.228280919016204, timestamps: { meanAnomaly: epoch },
  };
  const first = body('1', root, {
    ...common, semiMajorAxis: 0.0000476744237542346,
    argOfPeriapsis: 246.910533, radius: 6363.211,
  });
  const second = body('2', root, {
    ...common, semiMajorAxis: 0.0000816701119758518,
    argOfPeriapsis: 66.910538, radius: 5415.574,
  });
  body('A Ring', second, { type: 'Ring', innerRadius: 8155.4, outerRadius: 8158.6 });
  body('B Ring', second, { type: 'Ring', innerRadius: 8158.7, outerRadius: 8173.0 });
  body('1 a', first, {
    semiMajorAxis: 0.0000667281981855909, orbitalEccentricity: 0.000926,
    orbitalInclination: 5.715068, argOfPeriapsis: 356.875202,
    ascendingNode: -159.524488, meanAnomaly: 161.705977,
    orbitalPeriod: 0.106452093634259, radius: 337.0178125,
    timestamps: { meanAnomaly: epoch },
  });
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
  const fixtureSource = fs.readFileSync(path.join(repo, 'src/app/data/fixtures/swoiwns-collision.ts'), 'utf8');
  fs.writeFileSync(path.join(temporary, 'swoiwns.js'), ts.transpileModule(fixtureSource, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText);
  const root = system === 'swoiwns'
    ? require(path.join(temporary, 'swoiwns.js')).swoiwnsCollisionFamily()
    : system === 'eoch' ? eochPair() : muscaPair();
  const flatten = node => [node, ...node.subBodies.flatMap(flatten)];
  const subjects = flatten(root);
  const analyze = () => system === 'swoiwns'
    ? subjects.map(node => core.detectCollisionStatus(node, Date.parse(epoch)))
    : core.detectRingCollisionStatuses(root, Date.parse(epoch));
  const times = [];
  let statuses;
  for (let iteration = 0; iteration < 9; iteration++) {
    const start = performance.now();
    statuses = analyze();
    if (iteration >= 2) { times.push(performance.now() - start); }
  }
  times.sort((a, b) => a - b);
  const windows = statuses.map(status => ({
    candidate: status.isCandidate,
    partner: 'partnerName' in status ? status.partnerName : status.partner,
    windows: status.upcomingCollisions.map(window => ({
      start: window.start, end: window.end,
      minSeparationKm: window.minSeparationKm, minSeparationAt: window.minSeparationAt,
    })),
  }));
  console.log(JSON.stringify({
    system: system === 'swoiwns' ? 'Swoiwns TR-T b8-1 (body 6 family)' : system === 'eoch' ? 'Eoch Flyuae KS-V b18-2' : 'Musca Dark Region SO-Q b5-5',
    revision: revision ?? 'working tree', epoch,
    medianMs: times[3], minMs: times[0], maxMs: times[6],
    windowCounts: statuses.map(status => status.upcomingCollisions.length),
    windowFingerprint: createHash('sha256').update(JSON.stringify(windows)).digest('hex'),
  }, null, 2));
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}
