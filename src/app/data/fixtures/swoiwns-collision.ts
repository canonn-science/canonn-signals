import type { CanonnBiostatsBody, SystemBody } from '../../home/home.component';

/** Body 6 and its colliding moons, from the Canonn dump for Swoiwns TR-T b8-1.
 * Retrieved 2026-09-16; retain each recorded mean-anomaly timestamp.
 * https://us-central1-canonn-api-236217.cloudfunctions.net/query/codex/dump?id=2867292415561
 */
const bodies = [
  {
    "bodyId": 14,
    "name": "Swoiwns TR-T b8-1 6",
    "type": "Planet",
    "semiMajorAxis": 0.909775376226768,
    "orbitalEccentricity": 0.001064,
    "orbitalInclination": 0.453677,
    "orbitalPeriod": 494.244536040012,
    "ascendingNode": -155.364585,
    "argOfPeriapsis": 84.499658,
    "meanAnomaly": 279.234685,
    "radius": 77047.992,
    "timestamps": {
      "meanAnomaly": "2026-03-31T02:37:13Z"
    }
  },
  {
    "bodyId": 15,
    "name": "Swoiwns TR-T b8-1 6 a",
    "type": "Planet",
    "semiMajorAxis": 0.00415872553977889,
    "orbitalEccentricity": 0.002453,
    "orbitalInclination": 0.009772,
    "orbitalPeriod": 2.27556874354167,
    "ascendingNode": -34.886632,
    "argOfPeriapsis": 72.842537,
    "meanAnomaly": 335.35625,
    "radius": 1123.50025,
    "timestamps": {
      "meanAnomaly": "2026-03-31T02:37:13Z"
    }
  },
  {
    "bodyId": 16,
    "name": "Swoiwns TR-T b8-1 6 a a",
    "type": "Planet",
    "semiMajorAxis": 1.76673944880754e-05,
    "orbitalEccentricity": 0.0,
    "orbitalInclination": 67.988536,
    "orbitalPeriod": 0.234006676412037,
    "ascendingNode": -107.265331,
    "argOfPeriapsis": 123.499656,
    "meanAnomaly": 221.680645,
    "radius": 497.94171875,
    "timestamps": {
      "meanAnomaly": "2026-03-31T02:37:13Z"
    }
  },
  {
    "bodyId": 17,
    "name": "Swoiwns TR-T b8-1 6 b",
    "type": "Planet",
    "semiMajorAxis": 0.00416885891189136,
    "orbitalEccentricity": 0.000488,
    "orbitalInclination": 0.399202,
    "orbitalPeriod": 2.28389097309028,
    "ascendingNode": 130.820341,
    "argOfPeriapsis": 230.161054,
    "meanAnomaly": 62.208231,
    "radius": 1322.5515,
    "timestamps": {
      "meanAnomaly": "2026-03-31T02:37:14Z"
    }
  },
  {
    "bodyId": 18,
    "name": "Swoiwns TR-T b8-1 6 b a",
    "type": "Planet",
    "semiMajorAxis": 1.9282955161948e-05,
    "orbitalEccentricity": 0.0,
    "orbitalInclination": 30.492184,
    "orbitalPeriod": 0.211418109641204,
    "ascendingNode": 85.343221,
    "argOfPeriapsis": 283.532484,
    "meanAnomaly": 287.320169,
    "radius": 501.53709375,
    "timestamps": {
      "meanAnomaly": "2026-03-31T02:37:14Z"
    }
  }
];

export function swoiwnsCollisionFamily(): SystemBody {
  const nodes: SystemBody[] = bodies.map(bodyData => ({
    bodyData: { id64: 0n, subType: '', ...bodyData } as CanonnBiostatsBody,
    parent: null, subBodies: [],
  }));
  const parents = [null, 0, 1, 0, 3];
  nodes.forEach((node, i) => {
    const parentIndex = parents[i];
    if (parentIndex !== null) {
      node.parent = nodes[parentIndex];
      node.parent.subBodies.push(node);
    }
  });
  return nodes[0];
}
