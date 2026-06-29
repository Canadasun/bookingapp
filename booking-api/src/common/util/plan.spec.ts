import { getCapabilities } from './plan';

describe('plan capabilities', () => {
  it('enables multi-location management for Pro and Unlimited', () => {
    expect(getCapabilities('FREE').multipleLocations).toBe(false);
    expect(getCapabilities('BASIC').multipleLocations).toBe(false);
    expect(getCapabilities('PRO').multipleLocations).toBe(true);
    expect(getCapabilities('UNLIMITED').multipleLocations).toBe(true);
  });
});
