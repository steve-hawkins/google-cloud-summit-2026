/**
 * Calculates carbon emissions in grams of CO2 (gCO2).
 * 
 * @param intensity Carbon intensity of the grid in gCO2/kWh.
 * @param energyUsage Energy consumed by the workload in kWh.
 * @returns Total carbon emissions in grams (gCO2).
 */
export function calculateEmissions(intensity: number, energyUsage: number): number {
  return intensity * energyUsage;
}
