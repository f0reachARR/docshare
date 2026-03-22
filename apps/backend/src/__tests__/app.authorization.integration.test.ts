import type { Next } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const statusEditionIds = {
  draft: '00000000-0000-0000-0000-000000000001',
  accepting: '00000000-0000-0000-0000-000000000002',
  sharing: '00000000-0000-0000-0000-000000000003',
  closed: '00000000-0000-0000-0000-000000000004',
} as const;

type MatrixParticipationRow = {
  participation: {
    id: string;
    editionId: string;
    universityId: string;
    universityName: string;
    teamName: string | null;
    createdAt: string;
  };
};

type MatrixTemplateRow = {
  template: {
    id: string;
    name: string;
    acceptType: 'file' | 'url';
    sortOrder: number;
  };
};

type MatrixSubmissionRow = {
  id: string;
  templateId: string;
  participationId: string;
  submittedBy: string;
  version: number;
  fileS3Key: string | null;
  fileName: string | null;
  fileSizeBytes: number | null;
  fileMimeType: string | null;
  url: string | null;
  createdAt: string;
  updatedAt: string;
};

const mockDeleteWhere = vi.fn(async () => undefined);
const mockEditionSubmissionRows = vi.fn(async () => []);
const mockMatrixParticipationRows = vi.fn<() => Promise<MatrixParticipationRow[]>>(async () => []);
const mockMatrixTemplateRows = vi.fn<() => Promise<MatrixTemplateRow[]>>(async () => []);
const mockMatrixSubmissionRows = vi.fn<() => Promise<MatrixSubmissionRow[]>>(async () => []);
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
    const isMatrixParticipationSelect =
      typeof selection === 'object' &&
      selection !== null &&
      'participation' in selection &&
      !('submission' in selection);
    const isMatrixTemplateSelect =
      typeof selection === 'object' && selection !== null && 'template' in selection;
    const isMatrixSubmissionSelect =
      typeof selection === 'object' &&
      selection !== null &&
      'templateId' in selection &&
      'participationId' in selection &&
      'fileName' in selection;
    const isSubmissionParticipationSelect =
      typeof selection === 'object' &&
      selection !== null &&
      'participationId' in selection &&
      !('submission' in selection) &&
      !('fileName' in selection);
    const isAdminSelect =
      typeof selection === 'object' && selection !== null && 'isAdmin' in selection;

    if (isCountSelect) {
      return {
        from: () => ({
          innerJoin: () => ({
            where: mockCountRows,
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

    if (isMatrixParticipationSelect) {
      return {
        from: () => ({
          innerJoin: () => ({
            where: () => ({
              orderBy: () => ({
                limit: () => ({
                  offset: mockMatrixParticipationRows,
                }),
              }),
            }),
          }),
        }),
      };
    }

    if (isMatrixTemplateSelect) {
      return {
        from: () => ({
          where: () => ({
            orderBy: mockMatrixTemplateRows,
          }),
        }),
      };
    }

    if (isMatrixSubmissionSelect) {
      return {
        from: () => ({
          where: mockMatrixSubmissionRows,
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

const mockCanViewOtherSubmissionsByTemplate = vi.fn(
  async (_userId: string, editionId: string, templateId: string) => {
    if (editionId === statusEditionIds.draft || editionId === statusEditionIds.accepting) {
      return { allowed: false as const, reason: 'sharing_status_not_viewable' as const };
    }

    if (templateId === '20000000-0000-0000-0000-000000000002') {
      return { allowed: false as const, reason: 'template_not_submitted' as const };
    }

    return { allowed: true as const };
  },
);

vi.mock('../services/permissions.js', () => ({
  canDeleteSubmission: mockCanDeleteSubmission,
  canViewOtherSubmissionsByTemplate: mockCanViewOtherSubmissionsByTemplate,
  canViewParticipation: vi.fn(async () => true),
  canViewParticipationWithReason: vi.fn(async () => ({ allowed: true as const })),
  canComment: vi.fn(async () => true),
  canCommentWithReason: vi.fn(async () => ({ allowed: true as const })),
  canDeleteComment: vi.fn(async () => true),
  canEditComment: vi.fn(async () => true),
  getUserUniversityIds: vi.fn(async () => ['org-1']),
  isAdmin: vi.fn(async (userId: string) => userId === 'admin-user'),
  forbiddenReasonCodes: [
    'organization_context_required',
    'sharing_status_not_viewable',
    'organization_not_participating',
    'template_not_submitted',
    'template_context_required',
    'participation_not_found',
  ],
  publicForbiddenReasonCodes: ['context_required', 'access_denied'],
  toPublicForbiddenReason: vi.fn((reason: string) =>
    reason === 'organization_context_required' || reason === 'template_context_required'
      ? 'context_required'
      : 'access_denied',
  ),
}));

const { createApp } = await import('../app.js');

describe('authorization integration (app.request)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEditionSubmissionRows.mockResolvedValue([]);
    mockMatrixParticipationRows.mockResolvedValue([]);
    mockMatrixTemplateRows.mockResolvedValue([]);
    mockMatrixSubmissionRows.mockResolvedValue([]);
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

    const draftRes = await app.request(
      `/api/editions/${statusEditionIds.draft}/submissions?templateId=20000000-0000-0000-0000-000000000001`,
      {
        headers: { 'x-role': 'member' },
      },
    );
    expect(draftRes.status).toBe(403);

    const acceptingRes = await app.request(
      `/api/editions/${statusEditionIds.accepting}/submissions?templateId=20000000-0000-0000-0000-000000000001`,
      {
        headers: { 'x-role': 'member' },
      },
    );
    expect(acceptingRes.status).toBe(403);

    const sharingRes = await app.request(
      `/api/editions/${statusEditionIds.sharing}/submissions?templateId=20000000-0000-0000-0000-000000000001`,
      {
        headers: { 'x-role': 'member' },
      },
    );
    expect(sharingRes.status).toBe(200);

    const closedRes = await app.request(
      `/api/editions/${statusEditionIds.closed}/submissions?templateId=20000000-0000-0000-0000-000000000001`,
      {
        headers: { 'x-role': 'member' },
      },
    );
    expect(closedRes.status).toBe(200);

    const missingTemplateRes = await app.request(
      `/api/editions/${statusEditionIds.sharing}/submissions`,
      {
        headers: { 'x-role': 'member' },
      },
    );
    expect(missingTemplateRes.status).toBe(400);

    const matrixDraftRes = await app.request(
      `/api/editions/${statusEditionIds.draft}/submission-matrix`,
      {
        headers: { 'x-role': 'member' },
      },
    );
    expect(matrixDraftRes.status).toBe(200);

    const matrixAcceptingRes = await app.request(
      `/api/editions/${statusEditionIds.accepting}/submission-matrix`,
      {
        headers: { 'x-role': 'member' },
      },
    );
    expect(matrixAcceptingRes.status).toBe(200);

    const matrixSharingRes = await app.request(
      `/api/editions/${statusEditionIds.sharing}/submission-matrix`,
      {
        headers: { 'x-role': 'member' },
      },
    );
    expect(matrixSharingRes.status).toBe(200);

    const matrixClosedRes = await app.request(
      `/api/editions/${statusEditionIds.closed}/submission-matrix`,
      {
        headers: { 'x-role': 'member' },
      },
    );
    expect(matrixClosedRes.status).toBe(200);
  });

  it('GET /api/editions/:id/submission-matrix returns contract-compliant matrix response', async () => {
    const app = createApp();

    mockCountRows.mockResolvedValue([{ total: 2 }]);
    mockMatrixParticipationRows.mockResolvedValue([
      {
        participation: {
          id: '10000000-0000-0000-0000-000000000001',
          editionId: statusEditionIds.sharing,
          universityId: 'org-1',
          universityName: 'Org One',
          teamName: 'Team A',
          createdAt: '2026-03-20T00:00:00.000Z',
        },
      },
      {
        participation: {
          id: '10000000-0000-0000-0000-000000000002',
          editionId: statusEditionIds.sharing,
          universityId: 'org-2',
          universityName: 'Org Two',
          teamName: 'Team B',
          createdAt: '2026-03-20T00:10:00.000Z',
        },
      },
    ]);
    mockMatrixTemplateRows.mockResolvedValue([
      {
        template: {
          id: '20000000-0000-0000-0000-000000000001',
          name: 'Design PDF',
          acceptType: 'file',
          sortOrder: 1,
        },
      },
      {
        template: {
          id: '20000000-0000-0000-0000-000000000002',
          name: 'Demo URL',
          acceptType: 'url',
          sortOrder: 2,
        },
      },
    ]);
    mockMatrixSubmissionRows.mockResolvedValue([
      {
        id: '30000000-0000-0000-0000-000000000001',
        templateId: '20000000-0000-0000-0000-000000000001',
        participationId: '10000000-0000-0000-0000-000000000001',
        submittedBy: 'member-user',
        version: 2,
        fileS3Key: 'secret/internal/path.pdf',
        fileName: 'design.pdf',
        fileSizeBytes: 1234,
        fileMimeType: 'application/pdf',
        url: null,
        createdAt: '2026-03-20T02:00:00.000Z',
        updatedAt: '2026-03-20T02:05:00.000Z',
      },
      {
        id: '30000000-0000-0000-0000-000000000002',
        templateId: '20000000-0000-0000-0000-000000000002',
        participationId: '10000000-0000-0000-0000-000000000002',
        submittedBy: 'member-user',
        version: 1,
        fileS3Key: null,
        fileName: null,
        fileSizeBytes: null,
        fileMimeType: null,
        url: 'https://example.test/demo',
        createdAt: '2026-03-20T03:00:00.000Z',
        updatedAt: '2026-03-20T03:00:00.000Z',
      },
    ]);

    const res = await app.request(`/api/editions/${statusEditionIds.sharing}/submission-matrix`, {
      headers: { 'x-role': 'member' },
    });

    expect(res.status).toBe(200);

    const json = (await res.json()) as {
      templates: Array<{ id: string; sortOrder: number }>;
      rows: Array<{
        participation: { id: string };
        cells: Array<{
          submitted: boolean;
          viewable: boolean;
          denyReason: string | null;
          submission: Record<string, unknown> | null;
        }>;
      }>;
      pagination: { total: number };
    };

    expect(json.templates.map((template) => template.sortOrder)).toEqual([1, 2]);
    expect(json.rows).toHaveLength(2);
    expect(new Set(json.rows.map((row) => row.participation.id)).size).toBe(json.rows.length);

    for (const row of json.rows) {
      expect(row.cells).toHaveLength(json.templates.length);
    }

    const row1 = json.rows.find(
      (row) => row.participation.id === '10000000-0000-0000-0000-000000000001',
    );
    const row2 = json.rows.find(
      (row) => row.participation.id === '10000000-0000-0000-0000-000000000002',
    );

    expect(row1).toBeDefined();
    expect(row2).toBeDefined();
    expect(row1?.cells[1]).toEqual({
      submitted: false,
      viewable: true,
      denyReason: null,
      submission: null,
    });
    expect(row2?.cells[0]).toEqual({
      submitted: false,
      viewable: true,
      denyReason: null,
      submission: null,
    });

    expect(row1?.cells[0]).toMatchObject({
      submitted: true,
      viewable: true,
      denyReason: null,
      submission: {
        id: '30000000-0000-0000-0000-000000000001',
        templateId: '20000000-0000-0000-0000-000000000001',
        participationId: '10000000-0000-0000-0000-000000000001',
        submittedBy: 'member-user',
        version: 2,
        fileName: 'design.pdf',
        fileSizeBytes: 1234,
        fileMimeType: 'application/pdf',
        url: null,
        createdAt: '2026-03-20T02:00:00.000Z',
        updatedAt: '2026-03-20T02:05:00.000Z',
      },
    });
    expect(row1?.cells[0]?.submission).not.toHaveProperty('fileS3Key');
    expect(row2?.cells[1]).toMatchObject({
      submitted: true,
      viewable: false,
      denyReason: 'access_denied',
      submission: null,
    });
    expect(json.pagination.total).toBe(2);
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
    expect(json.paths['/api/editions/{id}/submission-matrix']).toBeDefined();
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
    expect(json.paths['/api/admin/users']).toBeDefined();
    expect(json.paths['/api/admin/users/{userId}/memberships']).toBeDefined();
    expect(json.paths['/api/admin/memberships/{memberId}/role']).toBeDefined();
    expect(json.paths['/api/admin/memberships/{memberId}']).toBeDefined();

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
        path: `/api/editions/${statusEditionIds.sharing}/submissions?templateId=20000000-0000-0000-0000-000000000001`,
        headers: { 'x-role': 'member' },
      },
      {
        path: `/api/editions/${statusEditionIds.sharing}/submission-matrix`,
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
      {
        path: '/api/admin/users',
        headers: { 'x-role': 'admin' },
      },
    ] as const;

    for (const testCase of cases) {
      const separator = testCase.path.includes('?') ? '&' : '?';
      const res = await app.request(`${testCase.path}${separator}sort=invalid:asc`, {
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
        path: `/api/editions/${statusEditionIds.sharing}/submissions?templateId=20000000-0000-0000-0000-000000000001`,
        headers: { 'x-role': 'member' },
      },
      {
        path: `/api/editions/${statusEditionIds.sharing}/submission-matrix`,
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
      {
        path: '/api/admin/users',
        headers: { 'x-role': 'admin' },
      },
    ] as const;

    for (const testCase of cases) {
      const separator = testCase.path.includes('?') ? '&' : '?';
      const res = await app.request(`${testCase.path}${separator}page=0&pageSize=101`, {
        headers: testCase.headers,
      });
      expect(res.status, `${testCase.path} should return 400 for invalid paging`).toBe(400);
    }
  });
});
