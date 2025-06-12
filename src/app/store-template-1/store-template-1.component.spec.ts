import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StoreTemplate1Component } from './store-template-1.component';

describe('StoreTemplate1Component', () => {
  let component: StoreTemplate1Component;
  let fixture: ComponentFixture<StoreTemplate1Component>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StoreTemplate1Component]
    })
    .compileComponents();

    fixture = TestBed.createComponent(StoreTemplate1Component);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
