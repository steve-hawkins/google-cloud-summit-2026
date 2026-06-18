import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { rateLimit } from 'express-rate-limit';
import { CarbonIntensityService } from './services/carbonIntensity.js';
import { SchedulerService } from './services/scheduler.js';
import { AgentService } from './services/agent.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createApp() {
  const app = express();
  const intensityService = new CarbonIntensityService();
  const schedulerService = new SchedulerService();
  const agentService = new AgentService();

  const chatLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute window
    limit: process.env.NODE_ENV === 'test' ? 3 : 30, // 3 requests in tests, 30 requests in production
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later.' }
  });

  app.use(express.json());
  
  // Serve static frontend assets
  app.use(express.static(path.join(__dirname, '../public')));

  // API Endpoints
  app.get('/api/intensity/current', async (req, res) => {
    const postcode = req.query.postcode as string | undefined;

    try {
      if (postcode) {
        const regionalData = await intensityService.getRegionalIntensity(postcode);
        return res.json(regionalData);
      } else {
        const nationalData = await intensityService.getCurrentNationalIntensity();
        return res.json(nationalData);
      }
    } catch (error: any) {
      return res.status(400).json({ error: error.message || 'Failed to fetch current carbon intensity' });
    }
  });

  app.get('/api/scheduler/optimize', async (req, res) => {
    const durationStr = req.query.durationHours as string | undefined;

    if (!durationStr) {
      return res.status(400).json({ error: 'Missing durationHours query parameter' });
    }

    const durationHours = parseFloat(durationStr);

    if (isNaN(durationHours) || durationHours <= 0) {
      return res.status(400).json({ error: 'durationHours must be a valid positive number' });
    }

    try {
      const forecast = await intensityService.getNationalForecast();
      const optimalSchedule = schedulerService.findOptimalWindow(forecast, durationHours);
      return res.json(optimalSchedule);
    } catch (error: any) {
      return res.status(400).json({ error: error.message || 'Failed to calculate optimal schedule' });
    }
  });

  app.post('/api/chat', chatLimiter, async (req, res) => {
    const { message } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Missing message in request body' });
    }

    try {
      const reply = await agentService.query(message);
      return res.json({ response: reply });
    } catch (error: any) {
      return res.status(500).json({ error: error.message || 'Agent query failed' });
    }
  });

  return app;
}
