import type { Next } from "hono";
import { HTTPException } from "hono/http-exception";
import { beforeEach, describe, expect, it, vi } from "vitest";

const statusEditionIds = {
  draft: "00000000-0000-0000-0000-000000000001",
  accepting: "00000000-0000-0000-0000-000000000002",
  sharing: "00000000-0000-0000-0000-000000000003",
  closed: "00000000-0000-0000-0000-000000000004",
} as const;

const mockDeleteWhere = vi.fn(async () => undefined);
const mockEditionSubmissionRows = vi.fn(async () => []);

const mockDb = {
  select: vi.fn((selection?: unknown) => {
    const isEditionSubmissionsSelect =
      typeof selection === "object" &&
      selection !== null &&
      "submission" in selection &&
      "participation" in selection;

    if (isEditionSubmissionsSelect) {
      return {
        from: () => ({
          innerJoin: () => ({
            innerJoin: () => ({
              where: () => ({
                orderBy: mockEditionSubmissionRows,
              }),
            }),
          }),
        }),
      };
    }

    return {
      from: () => ({
        where: () => ({
          limit: async () => [],
        }),
      }),
    };
  }),
  delete: vi.fn(() => ({
    where: mockDeleteWhere,
  })),
};

vi.mock('../db/index.js', () => ({ db: mockDb }));

vi.mock('../middleware/auth.js', () => ({
  requireAuth: async (
    c: {
      req: { header: (name: string) => string | undefined };
      set: (key: string, value: unknown) => void;
    },
    next: Next,
  ) => {
    const role = c.req.header("x-role");
    if (!role) {
      throw new HTTPException(401, { message: "Unauthorized" });
    }

    c.set("currentUser", {
      id: `${role}-user`,
      email: `${role}@example.com`,
      name: role,
      isAdmin: role === "admin",
    });

    await next();
  },
}));

vi.mock('../middleware/organization.js', () => ({
  resolveOrganization: async (
    c: {
      req: { header: (name: string) => string | undefined };
      set: (key: string, value: unknown) => void;
    },
    next: Next,
  ) => {
    c.set("organizationId", c.req.header("x-organization-id") ?? null);
    await next();
  },
}));

vi.mock('../middleware/admin.js', () => ({
  requireAdmin: async (
    c: { get: (key: string) => { isAdmin?: boolean } | undefined },
    next: Next,
  ) => {
    const user = c.get("currentUser");
    if (!user?.isAdmin) {
      throw new HTTPException(403, { message: "Admin only" });
    }
    await next();
  },
}));

const mockCanDeleteSubmission = vi.fn(async (userId: string) => {
  return userId === "admin-user" || userId === "owner-user";
});

const mockCanViewOtherSubmissions = vi.fn(
  async (_userId: string, editionId: string) => {
    return (
      editionId === statusEditionIds.sharing ||
      editionId === statusEditionIds.closed
    );
  },
);

vi.mock('../services/permissions.js', () => ({
  canDeleteSubmission: mockCanDeleteSubmission,
  canViewOtherSubmissions: mockCanViewOtherSubmissions,
  canViewParticipation: vi.fn(async () => true),
  canComment: vi.fn(async () => true),
  canDeleteComment: vi.fn(async () => true),
  canEditComment: vi.fn(async () => true),
  getUserUniversityIds: vi.fn(async () => ["org-1"]),
  isAdmin: vi.fn(async (userId: string) => userId === "admin-user"),
}));

const { createApp } = await import('../app.js');

describe("authorization integration (app.request)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEditionSubmissionRows.mockResolvedValue([]);
    mockDeleteWhere.mockResolvedValue(undefined);
  });

  it("submission delete permission matrix: admin/owner/member", async () => {
    const app = createApp();

    const adminRes = await app.request("/api/submissions/sub-1", {
      method: "DELETE",
      headers: { "x-role": "admin", "x-organization-id": "org-1" },
    });
    expect(adminRes.status).toBe(204);

    const ownerRes = await app.request("/api/submissions/sub-1", {
      method: "DELETE",
      headers: { "x-role": "owner", "x-organization-id": "org-1" },
    });
    expect(ownerRes.status).toBe(204);

    const memberRes = await app.request("/api/submissions/sub-1", {
      method: "DELETE",
      headers: { "x-role": "member", "x-organization-id": "org-1" },
    });
    expect(memberRes.status).toBe(403);
  });

  it("sharing_status branch matrix: draft/accepting/sharing/closed", async () => {
    const app = createApp();

    const draftRes = await app.request(
      `/api/editions/${statusEditionIds.draft}/submissions`,
      {
        headers: { "x-role": "member" },
      },
    );
    expect(draftRes.status).toBe(403);

    const acceptingRes = await app.request(
      `/api/editions/${statusEditionIds.accepting}/submissions`,
      {
        headers: { "x-role": "member" },
      },
    );
    expect(acceptingRes.status).toBe(403);

    const sharingRes = await app.request(
      `/api/editions/${statusEditionIds.sharing}/submissions`,
      {
        headers: { "x-role": "member" },
      },
    );
    expect(sharingRes.status).toBe(200);

    const closedRes = await app.request(
      `/api/editions/${statusEditionIds.closed}/submissions`,
      {
        headers: { "x-role": "member" },
      },
    );
    expect(closedRes.status).toBe(200);
  });

  it("openapi includes major API paths", async () => {
    const app = createApp();

    const res = await app.request("/api/openapi.json");
    expect(res.status).toBe(200);
    const json = (await res.json()) as { paths: Record<string, unknown> };

    expect(json.paths["/api/series"]).toBeDefined();
    expect(json.paths["/api/submissions"]).toBeDefined();
    expect(json.paths["/api/editions/{id}/submissions"]).toBeDefined();
    expect(json.paths["/api/participations/{id}/comments"]).toBeDefined();
    expect(json.paths["/api/university/members"]).toBeDefined();
    expect(json.paths["/api/admin/editions"]).toBeDefined();
  });
});
