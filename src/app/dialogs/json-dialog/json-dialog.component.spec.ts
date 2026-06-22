import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';

import { JsonDialogComponent, JsonDialogData } from './json-dialog.component';
import { SystemBody, CanonnBiostatsBody } from '../../home/home.component';

function makeBody(data: Partial<CanonnBiostatsBody>, parent: SystemBody | null = null): SystemBody {
  return {
    bodyData: { bodyId: 1, id64: 1n, name: 'Test Body', subType: '', type: 'Planet', ...data } as CanonnBiostatsBody,
    subBodies: [],
    parent,
  };
}

function setup(data: JsonDialogData): ComponentFixture<JsonDialogComponent> {
  TestBed.configureTestingModule({
    imports: [JsonDialogComponent],
    providers: [provideZonelessChangeDetection(), { provide: MAT_DIALOG_DATA, useValue: data }],
  });
  const fixture = TestBed.createComponent(JsonDialogComponent);
  fixture.detectChanges();
  return fixture;
}

describe('JsonDialogComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('formats the body JSON and renders the bodyId in the EDGalaxy link', () => {
    const fixture = setup({ body: makeBody({ subType: 'Rocky body', bodyId: 3 }), edGalaxyData: null });
    const c = fixture.componentInstance;
    expect(c.formattedBodyJson).toContain('"subType": "Rocky body"');
    expect(c.edGalaxyHref).toContain('bodyId=3');
  });

  it('falls back to the parent bodyId for a ring with no own id', () => {
    const parent = makeBody({ bodyId: 7 });
    const fixture = setup({ body: makeBody({ bodyId: -1, type: 'Ring' }, parent), edGalaxyData: null });
    expect(fixture.componentInstance.edGalaxyHref).toContain('bodyId=7');
  });

  it('flashes the copied state when copying succeeds', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    const fixture = setup({ body: makeBody({}), edGalaxyData: null });
    fixture.componentInstance.copyBodyJson();
    await Promise.resolve();
    expect(writeText).toHaveBeenCalled();
    expect(fixture.componentInstance.bodyJsonCopied()).toBe(true);
  });
});
