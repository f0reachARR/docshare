import { serve } from '@hono/node-server';
import { createApp } from './app.js';
import { env } from './lib/config.js';

const app = createApp();

serve(
  {
    fetch: app.fetch,
    port: env.PORT,
  },
  (info) => {
    console.log(`Backend listening on http://localhost:${info.port}`);
  },
);
