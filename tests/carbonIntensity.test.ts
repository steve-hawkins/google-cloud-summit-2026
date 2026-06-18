import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CarbonIntensityService } from '../src/services/carbonIntensity.js';

describe('CarbonIntensityService', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('getCurrentNationalIntensity returns formatted intensity data', async () => {
    const mockResponse = {
      data: [
        {
          from: '2026-06-18T10:00Z',
          to: '2026-06-18T10:30Z',
          intensity: {
            forecast: 150,
            actual: 145,
            index: 'moderate'
          }
        }
      ]
    };

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as Response);

    const service = new CarbonIntensityService();
    const result = await service.getCurrentNationalIntensity();

    expect(fetch).toHaveBeenCalledWith('https://api.carbonintensity.org.uk/intensity', {
      headers: { 'Accept': 'application/json' }
    });
    expect(result).toEqual({
      from: '2026-06-18T10:00Z',
      to: '2026-06-18T10:30Z',
      forecast: 150,
      actual: 145,
      index: 'moderate'
    });
  });

  it('getNationalForecast returns an array of forecast points', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-18T10:00:00Z'));

    const mockResponse = {
      data: [
        {
          from: '2026-06-18T10:00Z',
          to: '2026-06-18T10:30Z',
          intensity: { forecast: 120, index: 'low' }
        },
        {
          from: '2026-06-18T10:30Z',
          to: '2026-06-18T11:00Z',
          intensity: { forecast: 110, index: 'low' }
        }
      ]
    };

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as Response);

    const service = new CarbonIntensityService();
    const result = await service.getNationalForecast();

    expect(fetch).toHaveBeenCalledWith('https://api.carbonintensity.org.uk/intensity/2026-06-18T10:00Z/fw48h', {
      headers: { 'Accept': 'application/json' }
    });
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      from: '2026-06-18T10:00Z',
      to: '2026-06-18T10:30Z',
      intensity: 120,
      index: 'low'
    });

    vi.useRealTimers();
  });

  it('getRegionalIntensity returns regional carbon data for a postcode', async () => {
    const mockResponse = {
      data: [
        {
          regionid: 12,
          dnoregion: "UK Power Networks",
          shortname: "London",
          postcode: "SW1",
          data: [
            {
              from: '2026-06-18T10:00Z',
              to: '2026-06-18T10:30Z',
              intensity: {
                forecast: 85,
                index: 'low'
              },
              generationmix: [
                { fuel: 'coal', perc: 0 },
                { fuel: 'gas', perc: 45 },
                { fuel: 'wind', perc: 30 }
              ]
            }
          ]
        }
      ]
    };

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as Response);

    const service = new CarbonIntensityService();
    const result = await service.getRegionalIntensity('SW1');

    expect(fetch).toHaveBeenCalledWith('https://api.carbonintensity.org.uk/regional/postcode/SW1', {
      headers: { 'Accept': 'application/json' }
    });
    expect(result).toEqual({
      postcode: 'SW1',
      region: 'London',
      intensity: 85,
      index: 'low',
      generationmix: [
        { fuel: 'coal', perc: 0 },
        { fuel: 'gas', perc: 45 },
        { fuel: 'wind', perc: 30 }
      ]
    });
  });

  it('handles fetch failures gracefully', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      statusText: 'Bad Request',
    } as Response);

    const service = new CarbonIntensityService();
    await expect(service.getCurrentNationalIntensity()).rejects.toThrow('Failed to fetch carbon intensity: Bad Request');
  });

  describe('Caching behavior', () => {
    it('getCurrentNationalIntensity caches results and avoids redundant fetch calls', async () => {
      const mockResponse = {
        data: [
          {
            from: '2026-06-18T10:00Z',
            to: '2026-06-18T10:30Z',
            intensity: { forecast: 150, actual: 145, index: 'moderate' }
          }
        ]
      };

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const service = new CarbonIntensityService();
      
      // First call should trigger fetch
      const result1 = await service.getCurrentNationalIntensity();
      // Second call should hit cache, not triggering another fetch
      const result2 = await service.getCurrentNationalIntensity();

      expect(fetch).toHaveBeenCalledTimes(1);
      expect(result1).toEqual(result2);
    });

    it('getNationalForecast caches results and avoids redundant fetch calls', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-06-18T10:00:00Z'));

      const mockResponse = {
        data: [
          {
            from: '2026-06-18T10:00Z',
            to: '2026-06-18T10:30Z',
            intensity: { forecast: 120, index: 'low' }
          }
        ]
      };

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const service = new CarbonIntensityService();

      const result1 = await service.getNationalForecast();
      const result2 = await service.getNationalForecast();

      expect(fetch).toHaveBeenCalledTimes(1);
      expect(result1).toEqual(result2);

      vi.useRealTimers();
    });

    it('getRegionalIntensity caches results by postcode independently', async () => {
      const mockResponseSW1 = {
        data: [{
          shortname: "London",
          postcode: "SW1",
          data: [{
            intensity: { forecast: 85, index: 'low' },
            generationmix: []
          }]
        }]
      };
      const mockResponseEH1 = {
        data: [{
          shortname: "Edinburgh",
          postcode: "EH1",
          data: [{
            intensity: { forecast: 120, index: 'moderate' },
            generationmix: []
          }]
        }]
      };

      vi.mocked(fetch)
        .mockResolvedValueOnce({ ok: true, json: async () => mockResponseSW1 } as Response)
        .mockResolvedValueOnce({ ok: true, json: async () => mockResponseEH1 } as Response);

      const service = new CarbonIntensityService();

      // Call SW1 first time
      const sw1Result1 = await service.getRegionalIntensity('SW1');
      // Call SW1 second time (should be cached)
      const sw1Result2 = await service.getRegionalIntensity('SW1');
      
      // Call EH1 first time (different key, should trigger fetch)
      const eh1Result1 = await service.getRegionalIntensity('EH1');
      // Call EH1 second time (should be cached)
      const eh1Result2 = await service.getRegionalIntensity('EH1');

      expect(fetch).toHaveBeenCalledTimes(2); // 1 for SW1, 1 for EH1
      expect(sw1Result1).toEqual(sw1Result2);
      expect(eh1Result1).toEqual(eh1Result2);
      expect(sw1Result1.postcode).toBe('SW1');
      expect(eh1Result1.postcode).toBe('EH1');
    });
  });
});
