import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';

// Mock the services
vi.mock('../src/services/carbonIntensity.js', () => {
  return {
    CarbonIntensityService: vi.fn().mockImplementation(() => {
      return {
        getCurrentNationalIntensity: vi.fn().mockResolvedValue({
          from: '2026-06-18T10:00Z',
          to: '2026-06-18T10:30Z',
          forecast: 150,
          actual: 145,
          index: 'moderate'
        }),
        getRegionalIntensity: vi.fn().mockImplementation((postcode: string) => {
          if (postcode === 'INVALID') {
            return Promise.reject(new Error('No regional data returned for postcode: INVALID'));
          }
          return Promise.resolve({
            postcode,
            region: 'London',
            intensity: 85,
            index: 'low',
            generationmix: [{ fuel: 'gas', perc: 45 }]
          });
        }),
        getNationalForecast: vi.fn().mockResolvedValue([
          { from: '2026-06-18T10:00Z', to: '2026-06-18T10:30Z', intensity: 200, index: 'high' }
        ])
      };
    })
  };
});

vi.mock('../src/services/scheduler.js', () => {
  return {
    SchedulerService: vi.fn().mockImplementation(() => {
      return {
        findOptimalWindow: vi.fn().mockReturnValue({
          startTime: '2026-06-18T11:30Z',
          endTime: '2026-06-18T12:30Z',
          averageIntensity: 75,
          savingsPercentage: 61
        })
      };
    })
  };
});

describe('Express API Server', () => {
  let app: any;

  beforeEach(() => {
    app = createApp();
  });

  it('GET /api/intensity/current returns national data by default', async () => {
    const response = await request(app)
      .get('/api/intensity/current')
      .expect(200);

    expect(response.body).toEqual({
      from: '2026-06-18T10:00Z',
      to: '2026-06-18T10:30Z',
      forecast: 150,
      actual: 145,
      index: 'moderate'
    });
  });

  it('GET /api/intensity/current?postcode=SW1 returns regional data', async () => {
    const response = await request(app)
      .get('/api/intensity/current?postcode=SW1')
      .expect(200);

    expect(response.body.postcode).toBe('SW1');
    expect(response.body.region).toBe('London');
    expect(response.body.intensity).toBe(85);
  });

  it('GET /api/intensity/current?postcode=INVALID returns 400 error status', async () => {
    const response = await request(app)
      .get('/api/intensity/current?postcode=INVALID')
      .expect(400);

    expect(response.body).toHaveProperty('error');
  });

  it('GET /api/scheduler/optimize returns schedule advice', async () => {
    const response = await request(app)
      .get('/api/scheduler/optimize?durationHours=2.5')
      .expect(200);

    expect(response.body).toEqual({
      startTime: '2026-06-18T11:30Z',
      endTime: '2026-06-18T12:30Z',
      averageIntensity: 75,
      savingsPercentage: 61
    });
  });

  it('GET /api/scheduler/optimize returns 400 if durationHours is missing or invalid', async () => {
    await request(app)
      .get('/api/scheduler/optimize')
      .expect(400);

    await request(app)
      .get('/api/scheduler/optimize?durationHours=-1')
      .expect(400);

    await request(app)
      .get('/api/scheduler/optimize?durationHours=abc')
      .expect(400);
  });

  it('GET /healthz returns 200 OK status', async () => {
    const response = await request(app)
      .get('/healthz')
      .expect(200);

    expect(response.body).toHaveProperty('status', 'OK');
    expect(response.body).toHaveProperty('timestamp');
  });
});
