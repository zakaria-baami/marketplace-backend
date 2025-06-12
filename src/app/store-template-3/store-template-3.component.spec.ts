import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Template3Component } from './template-3.component';

describe('Template3Component', () => {
  let component: Template3Component;
  let fixture: ComponentFixture<Template3Component>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Template3Component]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Template3Component);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
