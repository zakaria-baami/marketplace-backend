import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StoreTemplate2Component } from './store-template-2.component';

describe('StoreTemplate2Component', () => {
  let component: StoreTemplate2Component;
  let fixture: ComponentFixture<StoreTemplate2Component>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StoreTemplate2Component]
    })
    .compileComponents();

    fixture = TestBed.createComponent(StoreTemplate2Component);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
