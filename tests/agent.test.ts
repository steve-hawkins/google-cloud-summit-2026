import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { AgentService } from '../src/services/agent.js';

// Setup mock for GoogleGenAI SDK
const mockGenerateContent = vi.fn();

vi.mock('@google/genai', () => {
  return {
    GoogleGenAI: vi.fn().mockImplementation(() => {
      return {
        models: {
          generateContent: mockGenerateContent
        }
      };
    })
  };
});

describe('AgentService (Unit Tests)', () => {
  beforeEach(() => {
    mockGenerateContent.mockReset();
    
    // Mock global fetch to return sample carbon intensity API responses
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/intensity/')) {
        // Forecast
        return {
          ok: true,
          json: async () => ({
            data: [
              { from: '2026-06-18T10:00Z', to: '2026-06-18T10:30Z', intensity: { forecast: 120, index: 'low' } },
              { from: '2026-06-18T10:30Z', to: '2026-06-18T11:00Z', intensity: { forecast: 110, index: 'low' } }
            ]
          })
        } as Response;
      } else if (url.includes('/regional/postcode/')) {
        // Regional
        return {
          ok: true,
          json: async () => ({
            data: [
              {
                from: '2026-06-18T10:00Z',
                to: '2026-06-18T10:30Z',
                regionid: 12,
                dnoregion: "UK Power Networks",
                shortname: "London",
                postcode: "SW1",
                intensity: { forecast: 85, index: 'low' },
                generationmix: [
                  { fuel: 'coal', perc: 0 },
                  { fuel: 'gas', perc: 45 }
                ]
              }
            ]
          })
        } as Response;
      } else if (url.endsWith('/intensity')) {
        // Current National
        return {
          ok: true,
          json: async () => ({
            data: [
              {
                from: '2026-06-18T10:00Z',
                to: '2026-06-18T10:30Z',
                intensity: { forecast: 150, actual: 145, index: 'moderate' }
              }
            ]
          })
        } as Response;
      }
      return { ok: false, status: 404 } as Response;
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('instantiates and provides a query method', () => {
    const agent = new AgentService();
    expect(agent.query).toBeTypeOf('function');
  });

  it('returns a response even if the Gemini API fails, via fallback mode', async () => {
    mockGenerateContent.mockRejectedValue(new Error('API Error'));
    const agent = new AgentService();
    const result = await agent.query('What is the current carbon intensity?');
    expect(result).toBeTypeOf('string');
    expect(result.length).toBeGreaterThan(0);
    // Verified fallback content contains some fallback indicators
    expect(result).toContain('UK national carbon intensity');
  });
  
  it('returns a response from Gemini when successful', async () => {
    mockGenerateContent.mockResolvedValue({
      text: 'Hello from mocked Gemini!'
    });
    const agent = new AgentService();
    const result = await agent.query('What is the current carbon intensity?');
    expect(result).toBe('Hello from mocked Gemini!');
  });
});

describe('Agent Chat API Endpoint (Integration Tests)', () => {
  let app: any;

  beforeEach(() => {
    app = createApp();
  });

  it('POST /api/chat returns a response from the agent', async () => {
    mockGenerateContent.mockResolvedValue({
      text: 'Mocked reply for chat endpoint'
    });
    const response = await request(app)
      .post('/api/chat')
      .send({ message: 'Is the grid clean today?' })
      .expect(200);

    expect(response.body).toHaveProperty('response');
    expect(response.body.response).toBeTypeOf('string');
  });

  it('POST /api/chat enforces rate limiting after 3 requests in test environment', async () => {
    mockGenerateContent.mockResolvedValue({
      text: 'Mocked reply'
    });

    // Send 3 requests (the threshold for the test environment)
    await request(app).post('/api/chat').send({ message: 'Msg 1' }).expect(200);
    await request(app).post('/api/chat').send({ message: 'Msg 2' }).expect(200);
    await request(app).post('/api/chat').send({ message: 'Msg 3' }).expect(200);

    // The 4th request must be blocked and return 429
    const response = await request(app)
      .post('/api/chat')
      .send({ message: 'Msg 4' })
      .expect(429);

    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toContain('Too many requests');
  });

  it('POST /api/chat returns 400 if message is missing', async () => {
    const response = await request(app)
      .post('/api/chat')
      .send({})
      .expect(400);

    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toContain('Missing message');
  });
});
