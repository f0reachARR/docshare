import { swaggerUI } from '@hono/swagger-ui';
import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { auth } from './auth.js';
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
