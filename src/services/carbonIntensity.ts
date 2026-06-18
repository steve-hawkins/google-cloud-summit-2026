export interface NationalIntensity {
  from: string;
  to: string;
  forecast: number;
  actual: number | null;
  index: string;
}

export interface ForecastPoint {
  from: string;
  to: string;
  intensity: number;
  index: string;
}

export interface FuelMix {
  fuel: string;
  perc: number;
}

export interface RegionalIntensity {
  postcode: string;
  region: string;
  intensity: number;
  index: string;
  generationmix: FuelMix[];
}

interface CacheEntry<T> {
  data: T;
  expiry: number;
}

export class CarbonIntensityService {
  private readonly baseUrl = 'https://api.carbonintensity.org.uk';
  private readonly cacheDurationMs = 15 * 60 * 1000; // 15 minutes cache duration

  private nationalIntensityCache: CacheEntry<NationalIntensity> | null = null;
  private forecastCache: CacheEntry<ForecastPoint[]> | null = null;
  private regionalCache = new Map<string, CacheEntry<RegionalIntensity>>();

  private async fetchJson<T>(endpoint: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch carbon intensity: ${response.statusText || response.status}`);
    }

    return response.json() as Promise<T>;
  }

  /**
   * Fetches the current national carbon intensity.
   */
  async getCurrentNationalIntensity(): Promise<NationalIntensity> {
    const now = Date.now();
    if (this.nationalIntensityCache && this.nationalIntensityCache.expiry > now) {
      return this.nationalIntensityCache.data;
    }

    const raw = await this.fetchJson<{ data: any[] }>('/intensity');
    if (!raw.data || raw.data.length === 0) {
      throw new Error('No current intensity data returned from API');
    }
    const item = raw.data[0];
    const data = {
      from: item.from,
      to: item.to,
      forecast: item.intensity.forecast,
      actual: item.intensity.actual,
      index: item.intensity.index
    };

    this.nationalIntensityCache = {
      data,
      expiry: now + this.cacheDurationMs
    };

    return data;
  }

  /**
   * Fetches the 48-hour national forecast.
   */
  async getNationalForecast(): Promise<ForecastPoint[]> {
    const now = Date.now();
    if (this.forecastCache && this.forecastCache.expiry > now) {
      return this.forecastCache.data;
    }

    const fromTime = new Date().toISOString().slice(0, 16) + 'Z';
    const raw = await this.fetchJson<{ data: any[] }>(`/intensity/${fromTime}/fw48h`);
    if (!raw.data) {
      throw new Error('No forecast data returned from API');
    }
    const data = raw.data.map(item => ({
      from: item.from,
      to: item.to,
      intensity: item.intensity.forecast,
      index: item.intensity.index
    }));

    this.forecastCache = {
      data,
      expiry: now + this.cacheDurationMs
    };

    return data;
  }

  /**
   * Fetches the current regional carbon intensity and fuel mix by outward postcode.
   * @param postcode Outward postcode (e.g. SW1, EH1)
   */
  async getRegionalIntensity(postcode: string): Promise<RegionalIntensity> {
    const cleanPostcode = postcode.trim().toUpperCase();
    const now = Date.now();
    const cached = this.regionalCache.get(cleanPostcode);
    if (cached && cached.expiry > now) {
      return cached.data;
    }

    const raw = await this.fetchJson<{ data: any[] }>(`/regional/postcode/${cleanPostcode}`);
    if (!raw.data || raw.data.length === 0) {
      throw new Error(`No regional data returned for postcode: ${postcode}`);
    }

    const item = raw.data[0];
    const nestedData = item.data && item.data.length > 0 ? item.data[0] : null;
    if (!nestedData) {
      throw new Error(`No inner intensity data found for postcode: ${postcode}`);
    }

    const data = {
      postcode: cleanPostcode,
      region: item.shortname || item.region || 'Unknown Region',
      intensity: nestedData.intensity.forecast ?? nestedData.intensity.actual ?? 0,
      index: nestedData.intensity.index,
      generationmix: nestedData.generationmix || []
    };

    this.regionalCache.set(cleanPostcode, {
      data,
      expiry: now + this.cacheDurationMs
    });

    return data;
  }
}
