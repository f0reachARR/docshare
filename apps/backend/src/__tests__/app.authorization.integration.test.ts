import type { Next } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const statusEditionIds = {
  draft: '00000000-0000-0000-0000-000000000001',
  accepting: '00000000-0000-0000-0000-000000000002',
  sharing: '00000000-0000-0000-0000-000000000003',
  closed: '00000000-0000-0000-0000-000000000004',
} as const;

const mockDeleteWhere = vi.fn(async () => undefined);
const mockEditionSubmissionRows = vi.fn(async () => []);
const mockCountRows = vi.fn(async () => [{ total: 0 }]);
const mockSubmissionParticipationRows = vi.fn(async () => [] as Array<{ participationId: string }>);
const mockAdminRows = vi.fn(async () => [{ isAdmin: true }]);

const mockDb = {
  select: vi.fn((selection?: unknown) => {
    const isCountSelect =
      typeof selection === 'object' && selection !== null && 'total' in selection;
    const isEditionSubmissionsSelect =
      typeof selection === 'object' &&
      selection !== null &&
      'submission' in selection &&
      'participation' in selection;
    const isSubmissionParticipationSelect =
      typeof selection === 'object' && selection !== null && 'participationId' in selection;
    const isAdminSelect =
      typeof selection === 'object' && selection !== null && 'isAdmin' in selection;

    if (isCountSelect) {
      return {
        from: () => ({
          innerJoin: () => ({
            innerJoin: () => ({
              where: mockCountRows,
            }),
          }),
          where: mockCountRows,
        }),
      };
    }

    if (isEditionSubmissionsSelect) {
      return {
        from: () => ({
          innerJoin: () => ({
            innerJoin: () => ({
              innerJoin: () => ({
                where: () => ({
                  orderBy: () => ({
                    limit: () => ({
                      offset: mockEditionSubmissionRows,
                    }),
                  }),
                }),
              }),
            }),
          }),
        }),
      };
    }

    if (isSubmissionParticipationSelect) {
      return {
        from: () => ({
          where: () => ({
            limit: mockSubmissionParticipationRows,
          }),
        }),
      };
    }

    if (isAdminSelect) {
      return {
        from: () => ({
          where: () => ({
            limit: mockAdminRows,
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
    const role = c.req.header('x-role');
    if (!role) {
      throw new HTTPException(401, { message: 'Unauthorized' });
    }

    c.set('currentUser', {
      id: `${role}-user`,
      email: `${role}@example.com`,
      name: role,
      isAdmin: role === 'admin',
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
    c.set('organizationId', c.req.header('x-organization-id') ?? null);
    await next();
  },
}));

vi.mock('../middleware/admin.js', () => ({
  requireAdmin: async (
    c: { get: (key: string) => { isAdmin?: boolean } | undefined },
    next: Next,
  ) => {
    const user = c.get('currentUser');
    if (!user?.isAdmin) {
      throw new HTTPException(403, { message: 'Admin only' });
    }
    await next();
  },
}));

const mockCanDeleteSubmission = vi.fn(async (userId: string) => {
  return userId === 'admin-user' || userId === 'owner-user';
});

const mockCanViewOtherSubmissions = vi.fn(async (_userId: string, editionId: string) => {
  return editionId === statusEditionIds.sharing || editionId === statusEditionIds.closed;
});

vi.mock('../services/permissions.js', () => ({
  canDeleteSubmission: mockCanDeleteSubmission,
  canViewOtherSubmissions: mockCanViewOtherSubmissions,
  canViewParticipation: vi.fn(async () => true),
  canComment: vi.fn(async () => true),
  canDeleteComment: vi.fn(async () => true),
  canEditComment: vi.fn(async () => true),
  getUserUniversityIds: vi.fn(async () => ['org-1']),
  isAdmin: vi.fn(async (userId: string) => userId === 'admin-user'),
}));

const { createApp } = await import('../app.js');

describe('authorization integration (app.request)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEditionSubmissionRows.mockResolvedValue([]);
    mockCountRows.mockResolvedValue([{ total: 0 }]);
    mockDeleteWhere.mockResolvedValue(undefined);
    mockSubmissionParticipationRows.mockResolvedValue([
      { participationId: '00000000-0000-0000-0000-000000000011' },
    ]);
    mockAdminRows.mockResolvedValue([{ isAdmin: true }]);
  });

  it('submission delete permission matrix: admin/owner/member', async () => {
    const app = createApp();

    const adminRes = await app.request('/api/submissions/sub-1', {
      method: 'DELETE',
      headers: { 'x-role': 'admin', 'x-organization-id': 'org-1' },
    });
    expect(adminRes.status).toBe(204);

    const ownerRes = await app.request('/api/submissions/sub-1', {
      method: 'DELETE',
      headers: { 'x-role': 'owner', 'x-organization-id': 'org-1' },
    });
    expect(ownerRes.status).toBe(204);

    const memberRes = await app.request('/api/submissions/sub-1', {
      method: 'DELETE',
      headers: { 'x-role': 'member', 'x-organization-id': 'org-1' },
    });
    expect(memberRes.status).toBe(403);
  });

  it('sharing_status branch matrix: draft/accepting/sharing/closed', async () => {
    const app = createApp();

    const draftRes = await app.request(`/api/editions/${statusEditionIds.draft}/submissions`, {
      headers: { 'x-role': 'member' },
    });
    expect(draftRes.status).toBe(403);

    const acceptingRes = await app.request(
      `/api/editions/${statusEditionIds.accepting}/submissions`,
      {
        headers: { 'x-role': 'member' },
      },
    );
    expect(acceptingRes.status).toBe(403);

    const sharingRes = await app.request(`/api/editions/${statusEditionIds.sharing}/submissions`, {
      headers: { 'x-role': 'member' },
    });
    expect(sharingRes.status).toBe(200);

    const closedRes = await app.request(`/api/editions/${statusEditionIds.closed}/submissions`, {
      headers: { 'x-role': 'member' },
    });
    expect(closedRes.status).toBe(200);
  });

  it('openapi includes major API paths', async () => {
    const app = createApp();

    const res = await app.request('/api/openapi.json');
    expect(res.status).toBe(200);
    const json = (await res.json()) as { paths: Record<string, unknown> };

    expect(json.paths['/api/series']).toBeDefined();
    expect(json.paths['/api/editions']).toBeDefined();
    expect(json.paths['/api/editions/{id}/templates']).toBeDefined();
    expect(json.paths['/api/editions/{id}/my-submissions']).toBeDefined();
    expect(json.paths['/api/submissions']).toBeDefined();
    expect(json.paths['/api/editions/{id}/submissions']).toBeDefined();
    expect(json.paths['/api/participations/{id}/comments']).toBeDefined();
    expect(json.paths['/api/submissions/{id}/history']).toBeDefined();
    expect(json.paths['/api/university/members']).toBeDefined();
    expect(json.paths['/api/admin/universities']).toBeDefined();
    expect(json.paths['/api/admin/editions']).toBeDefined();
    expect(json.paths['/api/upload/presign']).toBeDefined();
    expect(json.paths['/api/submissions/{id}']).toBeDefined();
    expect(json.paths['/api/submissions/{id}/download']).toBeDefined();
    expect(json.paths['/api/submission-history/{historyId}/download']).toBeDefined();
    expect(json.paths['/api/admin/series']).toBeDefined();
    expect(json.paths['/api/admin/series/{id}']).toBeDefined();
    expect(json.paths['/api/admin/editions/{id}']).toBeDefined();
    expect(json.paths['/api/admin/editions/{id}/rules/presign']).toBeDefined();
    expect(json.paths['/api/admin/editions/{id}/rules']).toBeDefined();
    expect(json.paths['/api/admin/participations/{id}']).toBeDefined();

    const seriesGet = json.paths['/api/series'] as {
      get?: { parameters?: Array<{ name?: string; in?: string }> };
    };
    const parameterNames = (seriesGet.get?.parameters ?? [])
      .filter((parameter) => parameter.in === 'query')
      .map((parameter) => parameter.name)
      .sort();

    expect(parameterNames).toContain('page');
    expect(parameterNames).toContain('pageSize');
    expect(parameterNames).toContain('q');
    expect(parameterNames).toContain('sort');
  });

  it('all target list APIs return 422 for invalid sort', async () => {
    const app = createApp();
    const cases = [
      {
        path: '/api/series',
        headers: undefined,
      },
      {
        path: '/api/editions',
        headers: undefined,
      },
      {
        path: '/api/editions/00000000-0000-0000-0000-000000000010/templates',
        headers: { 'x-role': 'member' },
      },
      {
        path: '/api/editions/00000000-0000-0000-0000-000000000010/my-submissions',
        headers: { 'x-role': 'member', 'x-organization-id': 'org-1' },
      },
      {
        path: `/api/editions/${statusEditionIds.sharing}/submissions`,
        headers: { 'x-role': 'member' },
      },
      {
        path: '/api/participations/00000000-0000-0000-0000-000000000011/comments',
        headers: { 'x-role': 'member' },
      },
      {
        path: '/api/submissions/00000000-0000-0000-0000-000000000012/history',
        headers: { 'x-role': 'member' },
      },
      {
        path: '/api/university/members',
        headers: { 'x-role': 'admin', 'x-organization-id': 'org-1' },
      },
      {
        path: '/api/admin/universities',
        headers: { 'x-role': 'admin' },
      },
      {
        path: '/api/participations/00000000-0000-0000-0000-000000000011/submissions',
        headers: { 'x-role': 'member', 'x-organization-id': 'org-1' },
      },
      {
        path: '/api/admin/editions/00000000-0000-0000-0000-000000000010/participations',
        headers: { 'x-role': 'admin' },
      },
    ] as const;

    for (const testCase of cases) {
      const res = await app.request(`${testCase.path}?sort=invalid:asc`, {
        headers: testCase.headers,
      });
      expect(res.status, `${testCase.path} should return 422 for invalid sort`).toBe(422);
    }
  });

  it('all target list APIs return 400 for invalid page/pageSize', async () => {
    const app = createApp();
    const cases = [
      {
        path: '/api/series',
        headers: undefined,
      },
      {
        path: '/api/editions',
        headers: undefined,
      },
      {
        path: '/api/editions/00000000-0000-0000-0000-000000000010/templates',
        headers: { 'x-role': 'member' },
      },
      {
        path: '/api/editions/00000000-0000-0000-0000-000000000010/my-submissions',
        headers: { 'x-role': 'member', 'x-organization-id': 'org-1' },
      },
      {
        path: `/api/editions/${statusEditionIds.sharing}/submissions`,
        headers: { 'x-role': 'member' },
      },
      {
        path: '/api/participations/00000000-0000-0000-0000-000000000011/comments',
        headers: { 'x-role': 'member' },
      },
      {
        path: '/api/submissions/00000000-0000-0000-0000-000000000012/history',
        headers: { 'x-role': 'member' },
      },
      {
        path: '/api/university/members',
        headers: { 'x-role': 'admin', 'x-organization-id': 'org-1' },
      },
      {
        path: '/api/admin/universities',
        headers: { 'x-role': 'admin' },
      },
      {
        path: '/api/participations/00000000-0000-0000-0000-000000000011/submissions',
        headers: { 'x-role': 'member', 'x-organization-id': 'org-1' },
      },
      {
        path: '/api/admin/editions/00000000-0000-0000-0000-000000000010/participations',
        headers: { 'x-role': 'admin' },
      },
    ] as const;

    for (const testCase of cases) {
      const res = await app.request(`${testCase.path}?page=0&pageSize=101`, {
        headers: testCase.headers,
      });
      expect(res.status, `${testCase.path} should return 400 for invalid paging`).toBe(400);
    }
  });
});
