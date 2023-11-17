import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SystemBodyComponent } from './system-body.component';

describe('SystemBodyComponent', () => {
  let component: SystemBodyComponent;
  let fixture: ComponentFixture<SystemBodyComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [SystemBodyComponent]
    });
    fixture = TestBed.createComponent(SystemBodyComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
