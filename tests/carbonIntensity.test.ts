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

    expect(fetch).toHaveBeenCalledWith('https://api.carbonintensity.org.uk/intensity/fw48h', {
      headers: { 'Accept': 'application/json' }
    });
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      from: '2026-06-18T10:00Z',
      to: '2026-06-18T10:30Z',
      intensity: 120,
      index: 'low'
    });
  });

  it('getRegionalIntensity returns regional carbon data for a postcode', async () => {
    const mockResponse = {
      data: [
        {
          from: '2026-06-18T10:00Z',
          to: '2026-06-18T10:30Z',
          regionid: 12,
          dnoregion: "UK Power Networks",
          shortname: "London",
          postcode: "SW1",
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
});
