import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal, WritableSignal } from '@angular/core';

import { GnosisRouteComponent } from './gnosis-route.component';
import { AppService } from '../app.service';
import { GNOSIS_ROUTE_STOPS } from '../data/gnosis-route';

describe('GnosisRouteComponent', () => {
  let component: GnosisRouteComponent;
  let fixture: ComponentFixture<GnosisRouteComponent>;
  let gnosisData$: WritableSignal<{ system: string } | null>;

  beforeEach(() => {
    gnosisData$ = signal<{ system: string } | null>(null);
    TestBed.configureTestingModule({
      imports: [GnosisRouteComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: AppService, useValue: { gnosisData: gnosisData$ } },
      ],
    });
    fixture = TestBed.createComponent(GnosisRouteComponent);
    component = fixture.componentInstance;
  });

  it('lists all 8 stops in visit order with none highlighted before Gnosis data arrives', () => {
    const stops = component.stops();
    expect(stops.map(s => s.name)).toEqual([...GNOSIS_ROUTE_STOPS]);
    expect(stops.every(s => !s.current)).toBe(true);
  });

  it('highlights the stop matching the live-tracked Gnosis position', () => {
    gnosisData$.set({ system: 'HIP 17862' });
    const stops = component.stops();
    expect(stops.find(s => s.current)?.name).toBe('HIP 17862');
    expect(stops.filter(s => s.current).length).toBe(1);
  });

  it('matches the current stop case/whitespace-insensitively', () => {
    gnosisData$.set({ system: '  epsilon indi  ' });
    expect(component.stops().find(s => s.current)?.name).toBe('Epsilon Indi');
  });

  it('highlights nothing when the live position is not one of the 8 stops', () => {
    gnosisData$.set({ system: 'Some Unrelated System' });
    expect(component.stops().every(s => !s.current)).toBe(true);
  });

  it('emits the stop name on select', () => {
    const emitted: string[] = [];
    component.stopSelected.subscribe(name => emitted.push(name));
    component.select('Varati');
    expect(emitted).toEqual(['Varati']);
  });

  it('renders a clickable node for every stop, with the current one tagged', () => {
    gnosisData$.set({ system: 'Kappa-1 Volantis' });
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    const stopEls = el.querySelectorAll('.gnosis-stop');
    expect(stopEls.length).toBe(8);
    expect(el.textContent).toContain('Kappa-1 Volantis');
    expect(el.querySelector('.gnosis-stop--current')?.textContent).toContain('Current position');
    expect(el.textContent).toContain('Loops back to Varati');
  });

  it('navigates when a stop is clicked', () => {
    fixture.detectChanges();
    const emitted: string[] = [];
    component.stopSelected.subscribe(name => emitted.push(name));
    const el: HTMLElement = fixture.nativeElement;
    (el.querySelector('.gnosis-stop') as HTMLElement).click();
    expect(emitted).toEqual(['Varati']);
  });
});
