import { TestBed } from '@angular/core/testing';

import { SynthService } from './synth.service';

describe('SyntService', () => {
  let service: SynthService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SynthService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
