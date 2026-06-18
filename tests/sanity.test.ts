import { describe, it, expect } from 'vitest';
import { calculateEmissions } from '../src/utils/carbon.js';

describe('Carbon emissions calculator', () => {
  it('calculates emissions correctly for a given intensity and energy usage', () => {
    // 50 gCO2/kWh intensity * 2 kWh energy usage = 100 gCO2 emissions
    const emissions = calculateEmissions(50, 2);
    expect(emissions).toBe(100);
  });
});
