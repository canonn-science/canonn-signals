import { Injectable } from '@angular/core';
import { OrbitalRelationsCore } from './orbital-relations.core';

/**
 * Angular-injectable facade over {@link OrbitalRelationsCore}. All the orbital maths lives in
 * the framework-free core so the collision web worker can import it without pulling any Angular
 * runtime into the worker bundle; this subclass exists only to provide `@Injectable` DI on the
 * main thread and to re-export the core's result types under the original module path, so
 * existing `import { CollisionWindow, LagrangeConfiguration, … } from './orbital-relations.service'`
 * sites keep resolving unchanged.
 *
 * The heavy collision methods (`detectCollisionStatus`, `simultaneousCollisionsWithin`,
 * `upcomingContactsWithin`, `separationSeries`) remain callable here synchronously — which is how
 * they stay unit-tested — but at runtime {@link SystemBodyComponent} runs them off the main thread
 * through {@link OrbitalWorkerService}. The light methods (trojan/rosette/anomaly/Lagrange) stay on
 * the main thread via this service.
 */
@Injectable({ providedIn: 'root' })
export class OrbitalRelationsService extends OrbitalRelationsCore {}

export * from './orbital-relations.core';
