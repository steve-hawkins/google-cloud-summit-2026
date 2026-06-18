import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { AgentService } from '../src/services/agent.js';

describe('AgentService (Unit Tests)', () => {
  it('instantiates and provides a query method', () => {
    const agent = new AgentService();
    expect(agent.query).toBeTypeOf('function');
  });

  it('returns a response even if the Gemini API fails, via fallback mode', async () => {
    const agent = new AgentService();
    const result = await agent.query('What is the current carbon intensity?');
    expect(result).toBeTypeOf('string');
    expect(result.length).toBeGreaterThan(0);
  });
});

describe('Agent Chat API Endpoint (Integration Tests)', () => {
  let app: any;

  beforeEach(() => {
    app = createApp();
  });

  it('POST /api/chat returns a response from the agent', async () => {
    const response = await request(app)
      .post('/api/chat')
      .send({ message: 'Is the grid clean today?' })
      .expect(200);

    expect(response.body).toHaveProperty('response');
    expect(response.body.response).toBeTypeOf('string');
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
