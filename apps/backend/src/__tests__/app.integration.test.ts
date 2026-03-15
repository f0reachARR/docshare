import { describe, expect, it } from 'vitest';
import { createApp } from '../app.js';

describe('app integration', () => {
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
