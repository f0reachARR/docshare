import { serve } from "@hono/node-server";
import { createApp } from "./app";
import { env } from "./lib/config";

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
