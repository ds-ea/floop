import { TestBed } from '@angular/core/testing';

import { FloopDeviceService } from './floop-device.service';

describe('FloopDeviceService', () => {
  let service: FloopDeviceService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(FloopDeviceService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
