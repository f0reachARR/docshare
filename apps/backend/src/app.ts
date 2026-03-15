import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { auth } from "./auth";
import { requireAdmin } from "./middleware/admin";
import { requireAuth } from "./middleware/auth";
import { resolveOrganization } from "./middleware/organization";
import { adminEditionRoutes } from "./routes/admin/editions";
import { adminParticipationRoutes } from "./routes/admin/participations";
import { adminSeriesRoutes } from "./routes/admin/series";
import { adminTemplateRoutes } from "./routes/admin/templates";
import { adminUniversityRoutes } from "./routes/admin/universities";
import { commentRoutes } from "./routes/comments";
import { editionProtectedRoutes } from "./routes/edition-protected";
import { editionRoutes } from "./routes/editions";
import { seriesRoutes } from "./routes/series";
import { submissionRoutes } from "./routes/submissions";
import { universityRoutes } from "./routes/university";
import { uploadRoutes } from "./routes/upload";

const healthRoute = createRoute({
  method: "get",
  path: "/api/health",
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.object({ ok: z.literal(true) }),
        },
      },
      description: "health check",
    },
  },
});

export const createApp = (): OpenAPIHono => {
  const app = new OpenAPIHono();

  app.doc("/api/openapi.json", {
    openapi: "3.0.0",
    info: {
      title: "Robocon Docshare API",
      version: "0.1.0",
    },
  });

  app.openapi(healthRoute, (c) => c.json({ ok: true }));

  app.on(["GET", "POST"], "/api/auth/*", async (c) => {
    // better-auth のハンドラーに委譲
    const response = await auth.handler(c.req.raw);
    return response;
  });

  app.route("/api", seriesRoutes);
  app.route("/api", editionRoutes);

  app.use("/api/*", requireAuth);
  app.use("/api/*", resolveOrganization);

  app.route("/api", editionProtectedRoutes);
  app.route("/api", submissionRoutes);
  app.route("/api", commentRoutes);
  app.route("/api", uploadRoutes);
  app.route("/api", universityRoutes);

  app.use("/api/admin/*", requireAdmin);
  app.route("/api/admin", adminSeriesRoutes);
  app.route("/api/admin", adminEditionRoutes);
  app.route("/api/admin", adminParticipationRoutes);
  app.route("/api/admin", adminTemplateRoutes);
  app.route("/api/admin", adminUniversityRoutes);

  return app;
};
