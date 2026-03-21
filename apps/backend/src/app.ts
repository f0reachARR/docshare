import { swaggerUI } from '@hono/swagger-ui';
import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { cors } from 'hono/cors';
import { auth } from './auth.js';
import { env } from './lib/config.js';
import { requireAdmin } from './middleware/admin.js';
import { requireAuth } from './middleware/auth.js';
import { resolveOrganization } from './middleware/organization.js';
import { adminEditionRoutes } from './routes/admin/editions.js';
import { adminParticipationRoutes } from './routes/admin/participations.js';
import { adminSeriesRoutes } from './routes/admin/series.js';
import { adminTemplateRoutes } from './routes/admin/templates.js';
import { adminUniversityRoutes } from './routes/admin/universities.js';
import { commentRoutes } from './routes/comments.js';
import { editionProtectedRoutes } from './routes/edition-protected.js';
import { editionRoutes } from './routes/editions.js';
import { meRoutes } from './routes/me.js';
import { participationRoutes } from './routes/participations.js';
import { seriesRoutes } from './routes/series.js';
import { submissionRoutes } from './routes/submissions.js';
import { universityRoutes } from './routes/university.js';
import { uploadRoutes } from './routes/upload.js';

const healthRoute = createRoute({
  method: 'get',
  path: '/api/health',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({ ok: z.literal(true) }),
        },
      },
      description: 'health check',
    },
  },
});

export const createApp = (): OpenAPIHono => {
  const app = new OpenAPIHono();

  app.doc('/api/openapi.json', {
    openapi: '3.0.0',
    info: {
      title: 'Robocon Docshare API',
      version: '0.1.0',
    },
  });

  app.get('/ui', swaggerUI({ url: '/api/openapi.json' }));

  app.use(
    '/api/*',
    cors({
      origin: (origin) => {
        if (!origin) {
          return '';
        }

        return env.CORS_ALLOWED_ORIGINS.includes(origin) ? origin : '';
      },
      allowHeaders: ['Content-Type', 'Authorization', 'X-Organization-Id'],
      allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      credentials: true,
    }),
  );

  app.openapi(healthRoute, (c) => c.json({ ok: true }));

  app.on(['GET', 'POST'], '/api/auth/*', async (c) => {
    // better-auth のハンドラーに委譲
    const response = await auth.handler(c.req.raw);
    return response;
  });

  app.route('/api', seriesRoutes);
  app.route('/api', editionRoutes);

  app.use('/api/*', requireAuth);
  app.use('/api/*', resolveOrganization);

  app.route('/api', meRoutes);
  app.route('/api', editionProtectedRoutes);
  app.route('/api', participationRoutes);
  app.route('/api', submissionRoutes);
  app.route('/api', commentRoutes);
  app.route('/api', uploadRoutes);
  app.route('/api', universityRoutes);

  app.use('/api/admin/*', requireAdmin);
  app.route('/api/admin', adminSeriesRoutes);
  app.route('/api/admin', adminEditionRoutes);
  app.route('/api/admin', adminParticipationRoutes);
  app.route('/api/admin', adminTemplateRoutes);
  app.route('/api/admin', adminUniversityRoutes);

  return app;
};
