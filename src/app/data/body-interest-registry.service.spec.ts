import { TestBed } from '@angular/core/testing';
import { CanonnBiostatsBody, SystemBody } from '../home/home.component';
import { BODY_TYPE } from './body-types';
import { BodyInterestRegistryService } from './body-interest-registry.service';

function makeBody(bodyId: number): SystemBody {
  const bodyData: CanonnBiostatsBody = {
    bodyId, id64: BigInt(Math.max(bodyId, 0)), name: `Body ${bodyId}`, type: BODY_TYPE.Planet, subType: 'Rocky body',
  };
  return { bodyData, subBodies: [], parent: null };
}

describe('BodyInterestRegistryService', () => {
  let service: BodyInterestRegistryService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(BodyInterestRegistryService);
  });

  it('starts empty', () => {
    expect(service.collisionCandidateBodies().size).toBe(0);
  });

  it('records a reported candidate for the current system', () => {
    const body = makeBody(42);
    service.resetForSystem(1n);
    service.reportCollisionCandidate(1n, body, true);
    expect(service.collisionCandidateBodies().has(body)).toBe(true);
  });

  it('removes a body once it is reported as no longer a candidate', () => {
    const body = makeBody(42);
    service.resetForSystem(1n);
    service.reportCollisionCandidate(1n, body, true);
    service.reportCollisionCandidate(1n, body, false);
    expect(service.collisionCandidateBodies().has(body)).toBe(false);
  });

  it('ignores a report keyed to a system that is no longer current', () => {
    const body = makeBody(42);
    service.resetForSystem(1n);
    service.reportCollisionCandidate(2n, body, true);
    expect(service.collisionCandidateBodies().size).toBe(0);
  });

  it('clears prior results when a different system is loaded', () => {
    const body = makeBody(42);
    service.resetForSystem(1n);
    service.reportCollisionCandidate(1n, body, true);
    service.resetForSystem(2n);
    expect(service.collisionCandidateBodies().size).toBe(0);
  });

  it('is a no-op when reset to the same system key it already has', () => {
    const body = makeBody(42);
    service.resetForSystem(1n);
    service.reportCollisionCandidate(1n, body, true);
    service.resetForSystem(1n);
    expect(service.collisionCandidateBodies().has(body)).toBe(true);
  });

  it('distinguishes two different bodies that share the same placeholder bodyId', () => {
    const ringA = makeBody(-1);
    const ringB = makeBody(-1);
    service.resetForSystem(1n);
    service.reportCollisionCandidate(1n, ringA, true);
    expect(service.collisionCandidateBodies().has(ringA)).toBe(true);
    expect(service.collisionCandidateBodies().has(ringB)).toBe(false);
  });
});
