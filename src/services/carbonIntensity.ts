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

export class CarbonIntensityService {
  private readonly baseUrl = 'https://api.carbonintensity.org.uk';

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
    const raw = await this.fetchJson<{ data: any[] }>('/intensity');
    if (!raw.data || raw.data.length === 0) {
      throw new Error('No current intensity data returned from API');
    }
    const item = raw.data[0];
    return {
      from: item.from,
      to: item.to,
      forecast: item.intensity.forecast,
      actual: item.intensity.actual,
      index: item.intensity.index
    };
  }

  /**
   * Fetches the 48-hour national forecast.
   */
  async getNationalForecast(): Promise<ForecastPoint[]> {
    const raw = await this.fetchJson<{ data: any[] }>('/intensity/fw48h');
    if (!raw.data) {
      throw new Error('No forecast data returned from API');
    }
    return raw.data.map(item => ({
      from: item.from,
      to: item.to,
      intensity: item.intensity.forecast,
      index: item.intensity.index
    }));
  }

  /**
   * Fetches the current regional carbon intensity and fuel mix by outward postcode.
   * @param postcode Outward postcode (e.g. SW1, EH1)
   */
  async getRegionalIntensity(postcode: string): Promise<RegionalIntensity> {
    const cleanPostcode = postcode.trim().toUpperCase();
    const raw = await this.fetchJson<{ data: any[] }>(`/regional/postcode/${cleanPostcode}`);
    if (!raw.data || raw.data.length === 0) {
      throw new Error(`No regional data returned for postcode: ${postcode}`);
    }
    
    // The regional postcode endpoint returns a nested structure
    // We map it to a flat, convenient format.
    const item = raw.data[0];
    return {
      postcode: cleanPostcode,
      region: item.shortname || item.region || 'Unknown Region',
      intensity: item.intensity.forecast ?? item.intensity.actual ?? 0,
      index: item.intensity.index,
      generationmix: item.generationmix || []
    };
  }
}
