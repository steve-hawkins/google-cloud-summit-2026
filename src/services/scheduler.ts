import { ForecastPoint } from './carbonIntensity.js';

export interface OptimalSchedule {
  startTime: string;
  endTime: string;
  averageIntensity: number;
  savingsPercentage: number;
}

export class SchedulerService {
  /**
   * Finds the contiguous half-hour windows in the forecast that minimize
   * the average carbon intensity for a workload of a specific duration.
   * 
   * @param forecast Array of half-hour forecast points.
   * @param durationHours Duration of the workload in hours.
   */
  findOptimalWindow(forecast: ForecastPoint[], durationHours: number): OptimalSchedule {
    // 1. Validation
    if (!forecast || forecast.length === 0) {
      throw new Error('Forecast data cannot be empty');
    }
    if (durationHours <= 0) {
      throw new Error('Duration must be greater than zero');
    }

    // Since the forecast has 30-minute (0.5 hour) resolution:
    const slotsNeeded = Math.ceil(durationHours / 0.5);

    if (slotsNeeded > forecast.length) {
      throw new Error('Duration exceeds the forecast window');
    }

    let minAverage = Infinity;
    let optimalStartIndex = 0;

    // 2. Sliding window search
    for (let i = 0; i <= forecast.length - slotsNeeded; i++) {
      let sum = 0;
      for (let j = 0; j < slotsNeeded; j++) {
        sum += forecast[i + j].intensity;
      }
      const average = sum / slotsNeeded;
      
      if (average < minAverage) {
        minAverage = average;
        optimalStartIndex = i;
      }
    }

    // 3. Compute immediate execution baseline (starting from slot 0)
    let immediateSum = 0;
    for (let j = 0; j < slotsNeeded; j++) {
      immediateSum += forecast[j].intensity;
    }
    const immediateAverage = immediateSum / slotsNeeded;

    // 4. Calculate percent savings
    // Avoid division by zero
    const savingsPercentage = immediateAverage > 0 
      ? Math.max(0, ((immediateAverage - minAverage) / immediateAverage) * 100)
      : 0;

    const bestWindow = forecast.slice(optimalStartIndex, optimalStartIndex + slotsNeeded);

    return {
      startTime: bestWindow[0].from,
      endTime: bestWindow[bestWindow.length - 1].to,
      averageIntensity: minAverage,
      savingsPercentage: savingsPercentage
    };
  }
}
