import { GoogleGenAI } from '@google/genai';
import { CarbonIntensityService } from './carbonIntensity.js';
import { SchedulerService } from './scheduler.js';

export class AgentService {
  private intensityService = new CarbonIntensityService();
  private schedulerService = new SchedulerService();
  private genAI: GoogleGenAI;

  constructor() {
    this.genAI = new GoogleGenAI({
      project: process.env.GCP_PROJECT || 'inlaid-fuze-499810-f7',
      location: process.env.GCP_REGION || 'us-central1',
      vertexai: true
    });
  }

  async query(message: string): Promise<string> {
    // 1. Gather necessary data
    let currentNational = null;
    let forecast = null;
    let regional = null;
    let postcodeFound = '';
    let schedulerInsights: any[] = [];

    try {
      currentNational = await this.intensityService.getCurrentNationalIntensity();
    } catch (e) {
      console.warn('Failed to fetch current national intensity:', e);
    }

    try {
      forecast = await this.intensityService.getNationalForecast();
      if (forecast && forecast.length > 0) {
        // Pre-calculate optimal windows for 1, 2, 4, and 8 hours tasks
        for (const hours of [1, 2, 4, 8]) {
          try {
            const optimal = this.schedulerService.findOptimalWindow(forecast, hours);
            schedulerInsights.push({
              durationHours: hours,
              ...optimal
            });
          } catch {}
        }
      }
    } catch (e) {
      console.warn('Failed to fetch forecast/calculate schedules:', e);
    }

    // Detect if user is querying a postcode (simple outward postcode regex)
    const postcodeMatch = message.toUpperCase().match(/\b([A-Z]{1,2}[0-9][A-Z0-9]?)\b/);
    if (postcodeMatch) {
      postcodeFound = postcodeMatch[1];
      try {
        regional = await this.intensityService.getRegionalIntensity(postcodeFound);
      } catch (e) {
        console.warn(`Failed to fetch regional intensity for ${postcodeFound}:`, e);
      }
    }

    // 2. Format context for Gemini
    const systemPrompt = `You are EcoPulse Agent, a friendly, carbon-aware AI assistant helping the user query grid statistics and schedule energy-intensive workloads.
Below is the real-time grid data and schedule calculations for the UK grid. Use this information to answer the user's query:

Current National Intensity:
${currentNational ? JSON.stringify(currentNational, null, 2) : 'Unavailable'}

Next 48-Hour National Forecast:
${forecast ? `Forecast ranges from ${Math.min(...forecast.map((f: any) => f.intensity))} to ${Math.max(...forecast.map((f: any) => f.intensity))} gCO2/kWh.` : 'Unavailable'}

Recommended Optimized Workload Windows (pre-calculated):
${schedulerInsights.length > 0 ? JSON.stringify(schedulerInsights, null, 2) : 'Unavailable'}

${regional ? `Regional Data for ${postcodeFound}:\n${JSON.stringify(regional, null, 2)}` : postcodeFound ? `No data found for postcode ${postcodeFound}` : ''}

Instructions:
- Provide clear, concise answers using Markdown.
- Point out specific recommendations (e.g. starting a task early or waiting for cleaner slots).
- Keep formatting clean.`;

    // 3. Attempt Gemini API call
    try {
      const response = await this.genAI.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: [
          { role: 'system', parts: [{ text: systemPrompt }] },
          { role: 'user', parts: [{ text: message }] }
        ]
      });

      if (response.text) {
        return response.text.trim();
      }
    } catch (err) {
      // Fallback mode if Vertex AI throws an error (e.g., API key, model availability 404, etc.)
      console.warn('Gemini API query failed, falling back to rule-based agent:', err);
    }

    // 4. Fallback Rule-Based Agent response generator
    return this.generateFallbackResponse(message, currentNational, forecast, regional, postcodeFound, schedulerInsights);
  }

  private generateFallbackResponse(
    message: string,
    currentNational: any,
    forecast: any,
    regional: any,
    postcodeFound: string,
    schedulerInsights: any[]
  ): string {
    const msgLower = message.toLowerCase();

    // Option A: User asks about scheduling or optimization
    if (msgLower.includes('schedule') || msgLower.includes('optimize') || msgLower.includes('best time') || msgLower.includes('run') || msgLower.includes('task') || msgLower.includes('workload')) {
      if (schedulerInsights.length === 0) {
        return "I'm sorry, I couldn't access the forecast data right now to calculate the optimal windows. Please check back shortly.";
      }
      
      let reply = `Based on the latest 48-hour UK grid forecast, here are the optimal start times for your tasks to minimize carbon emissions:\n\n`;
      schedulerInsights.forEach(insight => {
        const date = new Date(insight.startTime);
        const dateStr = date.toLocaleDateString('en-GB', { weekday: 'short', hour: '2-digit', minute: '2-digit' });
        reply += `- **${insight.durationHours}-Hour Task**: Best starting at **${dateStr}** with average intensity of **${Math.round(insight.averageIntensity)} gCO₂/kWh** (saving **${Math.round(insight.savingsPercentage)}%** vs. starting immediately).\n`;
      });
      reply += `\n*Tip: Running energy-intensive tasks (like ML training or heavy downloads) during these low-carbon windows helps stabilize the grid and reduce emissions.*`;
      return reply;
    }

    // Option B: Postcode lookup
    if (postcodeFound && regional) {
      let mixStr = regional.generationmix && regional.generationmix.length > 0 
        ? regional.generationmix.map((m: any) => `${m.fuel}: ${m.perc}%`).join(', ')
        : 'Unavailable';
      
      return `Here is the current carbon intensity for region **${regional.region}** (Postcode: **${postcodeFound}**):

- **Intensity**: ${regional.intensity} gCO₂/kWh
- **Index**: ${regional.index.toUpperCase()}
- **Generation Mix**: ${mixStr}

Compared to the national average, starting a task in this region is currently operating at a **${regional.index}** carbon footprint.`;
    }

    if (postcodeFound && !regional) {
      return `I recognized you mentioned the postcode **${postcodeFound}**, but I was unable to retrieve data for it. Please verify it is a valid UK outward postcode (e.g. SW1, EH1).`;
    }

    // Option C: General greeting or query about current stats
    if (currentNational) {
      let reply = `The current UK national carbon intensity is **${currentNational.forecast} gCO₂/kWh** (Index: **${currentNational.index.toUpperCase()}**).\n\n`;
      if (forecast && forecast.length > 0) {
        const intensities = forecast.map((f: any) => f.intensity);
        const minIntensity = Math.min(...intensities);
        const maxIntensity = Math.max(...intensities);
        reply += `Over the next 48 hours, the grid intensity is forecasted to range from a low of **${minIntensity} gCO₂/kWh** to a peak of **${maxIntensity} gCO₂/kWh**.\n\n`;
      }
      reply += `How can I help you optimize your workload? You can ask me:\n- *"When is the best time to run a 4 hour task?"*\n- *"What is the grid intensity in postcode EH1?"*`;
      return reply;
    }

    return "Hello! I am the EcoPulse Agent. I can help you query live UK grid carbon intensity, get regional statistics by postcode, or find the cleanest times to run your workloads. How can I help you today?";
  }
}
