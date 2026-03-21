import { describe, expect, it } from 'vitest';
import { createApp } from '../app.js';

describe('app integration', () => {
  it('returns cors headers for allowed origins', async () => {
    const app = createApp();
    const res = await app.request('/api/health', {
      headers: {
        Origin: 'http://localhost:3000',
      },
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('access-control-allow-origin')).toBe('http://localhost:3000');
    expect(res.headers.get('access-control-allow-credentials')).toBe('true');
  });

  it('handles preflight before auth middleware', async () => {
    const app = createApp();
    const res = await app.request('/api/submissions', {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://localhost:3000',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type,x-organization-id',
      },
    });

    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-origin')).toBe('http://localhost:3000');
    expect(res.headers.get('access-control-allow-credentials')).toBe('true');
  });

  it('returns health', async () => {
    const app = createApp();
    const res = await app.request('/api/health');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it('blocks private route without auth', async () => {
    const app = createApp();
    const res = await app.request('/api/submissions', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(401);
  });

  it('blocks editions templates route without auth', async () => {
    const app = createApp();
    const res = await app.request('/api/editions/00000000-0000-0000-0000-000000000001/templates');
    expect(res.status).toBe(401);
  });
});
