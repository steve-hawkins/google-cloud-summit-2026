import { describe, it, expect } from 'vitest';
import { SchedulerService } from '../src/services/scheduler.js';
import { ForecastPoint } from '../src/services/carbonIntensity.js';

describe('SchedulerService', () => {
  const mockForecast: ForecastPoint[] = [
    { from: '2026-06-18T10:00Z', to: '2026-06-18T10:30Z', intensity: 200, index: 'high' },
    { from: '2026-06-18T10:30Z', to: '2026-06-18T11:00Z', intensity: 180, index: 'moderate' },
    { from: '2026-06-18T11:00Z', to: '2026-06-18T11:30Z', intensity: 150, index: 'moderate' },
    { from: '2026-06-18T11:30Z', to: '2026-06-18T12:00Z', intensity: 80, index: 'low' },
    { from: '2026-06-18T12:00Z', to: '2026-06-18T12:30Z', intensity: 70, index: 'low' },
    { from: '2026-06-18T12:30Z', to: '2026-06-18T13:00Z', intensity: 90, index: 'low' },
    { from: '2026-06-18T13:00Z', to: '2026-06-18T13:30Z', intensity: 160, index: 'moderate' },
    { from: '2026-06-18T13:30Z', to: '2026-06-18T14:00Z', intensity: 210, index: 'high' }
  ];

  it('finds the lowest-carbon window for a specified duration', () => {
    const service = new SchedulerService();
    // 1-hour job requires 2 consecutive slots.
    // Slots 3-4 (11:30 to 12:30) have the lowest values: 80 and 70 (avg: 75)
    // Starting immediately is Slots 0-1 (10:00 to 11:00) with values: 200 and 180 (avg: 190)
    // Savings: (190 - 75) / 190 = 60.526%
    const schedule = service.findOptimalWindow(mockForecast, 1.0);

    expect(schedule.startTime).toBe('2026-06-18T11:30Z');
    expect(schedule.endTime).toBe('2026-06-18T12:30Z');
    expect(schedule.averageIntensity).toBe(75);
    expect(Math.round(schedule.savingsPercentage)).toBe(61);
  });

  it('returns 0% savings if the immediate window is already the best', () => {
    const service = new SchedulerService();
    // For a 0.5-hour job at slot 3-4, if we start the forecast at slot 3 (where 70 is the minimum)
    const lowForecast: ForecastPoint[] = [
      { from: '2026-06-18T12:00Z', to: '2026-06-18T12:30Z', intensity: 70, index: 'low' },
      { from: '2026-06-18T12:30Z', to: '2026-06-18T13:00Z', intensity: 90, index: 'low' },
      { from: '2026-06-18T13:00Z', to: '2026-06-18T13:30Z', intensity: 160, index: 'moderate' }
    ];
    const schedule = service.findOptimalWindow(lowForecast, 0.5);

    expect(schedule.startTime).toBe('2026-06-18T12:00Z');
    expect(schedule.averageIntensity).toBe(70);
    expect(schedule.savingsPercentage).toBe(0);
  });

  it('throws an error if duration exceeds the forecast length', () => {
    const service = new SchedulerService();
    // Forecast is 4 hours (8 slots). Asking for 5 hours should throw.
    expect(() => service.findOptimalWindow(mockForecast, 5.0)).toThrow('Duration exceeds the forecast window');
  });

  it('throws an error for invalid input values', () => {
    const service = new SchedulerService();
    expect(() => service.findOptimalWindow([], 1.0)).toThrow('Forecast data cannot be empty');
    expect(() => service.findOptimalWindow(mockForecast, 0)).toThrow('Duration must be greater than zero');
    expect(() => service.findOptimalWindow(mockForecast, -2.5)).toThrow('Duration must be greater than zero');
  });
});
