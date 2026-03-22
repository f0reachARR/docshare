import type { Next } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type DbQueueItem = unknown;
const dbQueue: DbQueueItem[] = [];

const enqueueDb = (...items: DbQueueItem[]): void => {
  dbQueue.push(...items);
};

const dequeueDb = async (): Promise<DbQueueItem> => {
  if (dbQueue.length === 0) {
    return [];
  }
  return dbQueue.shift() ?? [];
};

const createAwaitableBuilder = () => {
  const builder: {
    from: ReturnType<typeof vi.fn>;
    innerJoin: ReturnType<typeof vi.fn>;
    leftJoin: ReturnType<typeof vi.fn>;
    where: ReturnType<typeof vi.fn>;
    orderBy: ReturnType<typeof vi.fn>;
    groupBy: ReturnType<typeof vi.fn>;
    having: ReturnType<typeof vi.fn>;
    limit: ReturnType<typeof vi.fn>;
    offset: ReturnType<typeof vi.fn>;
    values: ReturnType<typeof vi.fn>;
    set: ReturnType<typeof vi.fn>;
    returning: ReturnType<typeof vi.fn>;
    then: <TResult1 = DbQueueItem, TResult2 = never>(
      onfulfilled?: ((value: DbQueueItem) => TResult1 | PromiseLike<TResult1>) | null,
      onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
    ) => Promise<TResult1 | TResult2>;
  } = {
    from: vi.fn(() => builder),
    innerJoin: vi.fn(() => builder),
    leftJoin: vi.fn(() => builder),
    where: vi.fn(() => builder),
    orderBy: vi.fn(() => builder),
    groupBy: vi.fn(() => builder),
    having: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    offset: vi.fn(async () => dequeueDb()),
    values: vi.fn(() => builder),
    set: vi.fn(() => builder),
    returning: vi.fn(async () => dequeueDb()),
    // biome-ignore lint/suspicious/noThenProperty: Test double emulates Drizzle's awaitable query builder.
    then: (onfulfilled, onrejected) => dequeueDb().then(onfulfilled, onrejected),
  };

  return builder;
};

const mockDb = {
  select: vi.fn(() => createAwaitableBuilder()),
  insert: vi.fn(() => createAwaitableBuilder()),
  update: vi.fn(() => createAwaitableBuilder()),
  delete: vi.fn(() => createAwaitableBuilder()),
};

vi.mock('../db/index.js', () => ({ db: mockDb }));

vi.mock('../auth.js', () => ({
  auth: {
    handler: vi.fn(async () => new Response('Not Found', { status: 404 })),
  },
}));

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
    c.set('sessionActiveOrganizationId', c.req.header('x-session-org') ?? null);

    await next();
  },
}));

vi.mock('../middleware/organization.js', () => ({
  resolveOrganization: async (
    c: {
      req: { header: (name: string) => string | undefined };
      set: (key: string, value: unknown) => void;
      get: (key: string) => string | null;
    },
    next: Next,
  ) => {
    const organizationId =
      c.req.header('x-organization-id') ?? c.get('sessionActiveOrganizationId');
    c.set('organizationId', organizationId ?? null);
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

const mockCanViewParticipation = vi.fn(async () => true);
const mockCanViewOtherSubmissionsByTemplate = vi.fn(async () => ({ allowed: true as const }));
const mockCanViewParticipationWithReason = vi.fn(async () => ({ allowed: true as const }));
const mockGetObjectMetadata = vi.fn(async () => ({
  contentLength: 1024,
  contentType: 'application/pdf',
}));
const mockPresignDownload = vi.fn(async (_bucket: string, key: string) => ({
  presignedUrl: `https://files.example.test/${key}`,
  expiresIn: 300,
}));

vi.mock('../services/permissions.js', () => ({
  canDeleteSubmission: vi.fn(async () => true),
  canViewOtherSubmissionsByTemplate: mockCanViewOtherSubmissionsByTemplate,
  canViewParticipation: mockCanViewParticipation,
  canViewParticipationWithReason: mockCanViewParticipationWithReason,
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

vi.mock('../services/storage.js', () => ({
  buildRuleKey: vi.fn(),
  buildVersionedSubmissionKey: vi.fn(),
  getObjectMetadata: mockGetObjectMetadata,
  matchesVersionedSubmissionKey: vi.fn(),
  presignDownload: mockPresignDownload,
  presignUpload: vi.fn(),
  presignUploadByKey: vi.fn(),
}));

const { createApp } = await import('../app.js');

describe('issue #11 api integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbQueue.length = 0;
    mockCanViewParticipationWithReason.mockResolvedValue({ allowed: true as const });
    mockGetObjectMetadata.mockResolvedValue({
      contentLength: 1024,
      contentType: 'application/pdf',
    });
  });

  it('GET /api/me returns current user profile', async () => {
    const app = createApp();

    enqueueDb([
      {
        organizationId: 'org-1',
        organizationName: 'Org One',
        organizationSlug: 'org-one',
        role: 'owner',
      },
    ]);

    const res = await app.request('/api/me', {
      headers: {
        'x-role': 'owner',
        'x-organization-id': 'org-1',
      },
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      data: {
        user: {
          id: 'owner-user',
          email: 'owner@example.com',
          name: 'owner',
          isAdmin: false,
        },
        organizations: [
          {
            id: 'org-1',
            name: 'Org One',
            slug: 'org-one',
            role: 'owner',
          },
        ],
        activeOrganizationId: 'org-1',
      },
    });
  });

  it('GET /api/editions/:id/my-participations validates and returns rows', async () => {
    const app = createApp();

    const noOrgRes = await app.request(
      '/api/editions/00000000-0000-0000-0000-000000000001/my-participations',
      {
        headers: { 'x-role': 'member' },
      },
    );
    expect(noOrgRes.status).toBe(400);

    enqueueDb([
      {
        id: '10000000-0000-0000-0000-000000000001',
        editionId: '00000000-0000-0000-0000-000000000001',
        universityId: 'org-1',
        universityName: 'Org One',
        teamName: 'Team A',
        createdAt: '2026-03-20T00:00:00.000Z',
      },
    ]);

    const okRes = await app.request(
      '/api/editions/00000000-0000-0000-0000-000000000001/my-participations',
      {
        headers: { 'x-role': 'member', 'x-organization-id': 'org-1' },
      },
    );

    expect(okRes.status).toBe(200);
    expect(await okRes.json()).toEqual({
      data: [
        {
          id: '10000000-0000-0000-0000-000000000001',
          editionId: '00000000-0000-0000-0000-000000000001',
          universityId: 'org-1',
          universityName: 'Org One',
          teamName: 'Team A',
          createdAt: '2026-03-20T00:00:00.000Z',
        },
      ],
    });
  });

  it('GET /api/editions/:id/my-submission-status returns aggregated view', async () => {
    const app = createApp();

    enqueueDb(
      [{ id: 'e1', sharingStatus: 'accepting' }],
      [{ id: 'p1', teamName: 'Team A' }],
      [
        {
          id: 't1',
          name: 'Concept',
          acceptType: 'file',
          isRequired: true,
          allowedExtensions: ['pdf'],
          urlPattern: null,
          maxFileSizeMb: 100,
          sortOrder: 0,
        },
      ],
      [
        {
          participationId: 'p1',
          templateId: 't1',
          id: 's1',
          version: 2,
          fileName: 'concept.pdf',
          url: null,
          updatedAt: '2026-03-20T00:00:00.000Z',
        },
      ],
    );

    const res = await app.request(
      '/api/editions/00000000-0000-0000-0000-000000000001/my-submission-status',
      {
        headers: { 'x-role': 'member', 'x-organization-id': 'org-1' },
      },
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      data: {
        edition: {
          id: 'e1',
          sharingStatus: 'accepting',
        },
        participations: [{ id: 'p1', teamName: 'Team A' }],
        templates: [
          {
            id: 't1',
            name: 'Concept',
            acceptType: 'file',
            isRequired: true,
            allowedExtensions: ['pdf'],
            urlPattern: null,
            maxFileSizeMb: 100,
            sortOrder: 0,
          },
        ],
        items: [
          {
            participationId: 'p1',
            templateId: 't1',
            submission: {
              id: 's1',
              version: 2,
              fileName: 'concept.pdf',
              url: null,
              updatedAt: '2026-03-20T00:00:00.000Z',
            },
          },
        ],
      },
    });
  });

  it('GET /api/participations/:id and /api/participations/:id/submissions return details', async () => {
    const app = createApp();

    enqueueDb([
      {
        id: 'p1',
        editionId: 'e1',
        universityId: 'org-1',
        universityName: 'Org One',
        teamName: 'Team A',
        createdAt: '2026-03-20T00:00:00.000Z',
      },
    ]);

    const detailRes = await app.request(
      '/api/participations/10000000-0000-0000-0000-000000000001',
      {
        headers: { 'x-role': 'member', 'x-organization-id': 'org-1' },
      },
    );
    expect(detailRes.status).toBe(200);

    enqueueDb(
      [{ id: 'p1' }],
      [{ total: 1 }],
      [
        {
          id: 's1',
          templateId: 't1',
          templateName: 'Concept',
          templateAcceptType: 'file',
          version: 3,
          fileName: 'concept-v3.pdf',
          url: null,
          updatedAt: '2026-03-20T00:00:00.000Z',
        },
      ],
    );

    const submissionsRes = await app.request(
      '/api/participations/10000000-0000-0000-0000-000000000001/submissions',
      {
        headers: { 'x-role': 'member', 'x-organization-id': 'org-1' },
      },
    );
    expect(submissionsRes.status).toBe(200);
    expect(await submissionsRes.json()).toEqual({
      data: [
        {
          id: 's1',
          template: {
            id: 't1',
            name: 'Concept',
            acceptType: 'file',
          },
          version: 3,
          fileName: 'concept-v3.pdf',
          url: null,
          updatedAt: '2026-03-20T00:00:00.000Z',
        },
      ],
      pagination: {
        page: 1,
        pageSize: 20,
        total: 1,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      },
    });
  });

  it('GET /api/participations/:id forwards templateId query to permission check', async () => {
    const app = createApp();

    enqueueDb([
      {
        id: 'p1',
        editionId: 'e1',
        universityId: 'org-1',
        universityName: 'Org One',
        teamName: 'Team A',
        createdAt: '2026-03-20T00:00:00.000Z',
      },
    ]);

    const res = await app.request(
      '/api/participations/10000000-0000-0000-0000-000000000001?templateId=20000000-0000-0000-0000-000000000001',
      {
        headers: { 'x-role': 'member', 'x-organization-id': 'org-1' },
      },
    );

    expect(res.status).toBe(200);
    expect(mockCanViewParticipationWithReason).toHaveBeenCalledWith(
      'member-user',
      '10000000-0000-0000-0000-000000000001',
      'org-1',
      '20000000-0000-0000-0000-000000000001',
    );
  });

  it('P1 endpoints: admin participations and last-owner guard', async () => {
    const app = createApp();

    enqueueDb([
      {
        id: 'p1',
        editionId: 'e1',
        universityId: 'org-1',
        universityName: 'Org One',
        teamName: 'Team A',
        createdAt: '2026-03-20T00:00:00.000Z',
      },
    ]);

    const adminRes = await app.request(
      '/api/admin/editions/00000000-0000-0000-0000-000000000001/participations',
      {
        headers: { 'x-role': 'admin' },
      },
    );
    expect(adminRes.status).toBe(200);

    enqueueDb(
      [{ isAdmin: false }],
      [{ role: 'owner' }],
      [{ id: 'm-owner', role: 'owner' }],
      [{ total: 1 }],
    );

    const putRes = await app.request('/api/university/members/m-owner/role', {
      method: 'PUT',
      headers: { 'x-role': 'owner', 'x-organization-id': 'org-1' },
      body: JSON.stringify({ role: 'member' }),
    });
    expect(putRes.status).toBe(409);

    enqueueDb(
      [{ isAdmin: false }],
      [{ role: 'owner' }],
      [{ id: 'm-owner', role: 'owner' }],
      [{ total: 1 }],
    );

    const deleteRes = await app.request('/api/university/members/m-owner', {
      method: 'DELETE',
      headers: { 'x-role': 'owner', 'x-organization-id': 'org-1' },
    });
    expect(deleteRes.status).toBe(409);
  });

  it('admin users API: list and memberships CRUD', async () => {
    const app = createApp();

    enqueueDb(
      [{ total: 2 }],
      [
        {
          id: 'u-1',
          name: 'Alice',
          email: 'alice@example.com',
          isAdmin: false,
          createdAt: '2026-03-20T00:00:00.000Z',
          organizationCount: 3,
        },
        {
          id: 'u-2',
          name: 'Bob',
          email: 'bob@example.com',
          isAdmin: true,
          createdAt: '2026-03-21T00:00:00.000Z',
          organizationCount: 1,
        },
      ],
    );

    const listRes = await app.request('/api/admin/users?page=1&pageSize=10&q=ali&sort=email:asc', {
      headers: { 'x-role': 'admin' },
    });
    expect(listRes.status).toBe(200);
    expect(await listRes.json()).toEqual({
      data: [
        {
          id: 'u-1',
          name: 'Alice',
          email: 'alice@example.com',
          isAdmin: false,
          createdAt: '2026-03-20T00:00:00.000Z',
          organizationCount: 3,
        },
        {
          id: 'u-2',
          name: 'Bob',
          email: 'bob@example.com',
          isAdmin: true,
          createdAt: '2026-03-21T00:00:00.000Z',
          organizationCount: 1,
        },
      ],
      pagination: {
        page: 1,
        pageSize: 10,
        total: 2,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      },
    });

    enqueueDb(
      [{ id: 'u-1' }],
      [
        {
          memberId: 'm-1',
          organizationId: 'org-1',
          organizationName: 'Org One',
          organizationSlug: 'org-one',
          role: 'owner',
          createdAt: '2026-03-20T00:00:00.000Z',
        },
      ],
    );

    const membershipsRes = await app.request('/api/admin/users/u-1/memberships', {
      headers: { 'x-role': 'admin' },
    });
    expect(membershipsRes.status).toBe(200);
    expect(await membershipsRes.json()).toEqual({
      data: [
        {
          memberId: 'm-1',
          organizationId: 'org-1',
          organizationName: 'Org One',
          organizationSlug: 'org-one',
          role: 'owner',
          createdAt: '2026-03-20T00:00:00.000Z',
        },
      ],
    });

    enqueueDb(
      [{ id: 'u-1' }],
      [{ id: 'org-2' }],
      [],
      [
        {
          id: 'm-2',
          userId: 'u-1',
          organizationId: 'org-2',
          role: 'member',
          createdAt: '2026-03-22T00:00:00.000Z',
        },
      ],
    );

    const createRes = await app.request('/api/admin/users/u-1/memberships', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-role': 'admin',
      },
      body: JSON.stringify({ organizationId: 'org-2', role: 'member' }),
    });
    expect(createRes.status).toBe(201);

    enqueueDb([{ id: 'u-1' }], [{ id: 'org-2' }], [{ id: 'm-2' }]);
    const duplicateRes = await app.request('/api/admin/users/u-1/memberships', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-role': 'admin',
      },
      body: JSON.stringify({ organizationId: 'org-2', role: 'member' }),
    });
    expect(duplicateRes.status).toBe(409);

    enqueueDb(
      [{ id: 'u-1' }],
      [{ id: 'org-2' }],
      [],
      Promise.reject({ code: '23505', constraint: 'member_org_user_unique' }),
    );
    const raceDuplicateRes = await app.request('/api/admin/users/u-1/memberships', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-role': 'admin',
      },
      body: JSON.stringify({ organizationId: 'org-2', role: 'member' }),
    });
    expect(raceDuplicateRes.status).toBe(409);
    expect(await raceDuplicateRes.json()).toEqual({ error: 'Membership already exists' });

    enqueueDb(
      [{ id: 'm-2', userId: 'u-1', organizationId: 'org-2', role: 'member' }],
      [
        {
          id: 'm-2',
          userId: 'u-1',
          organizationId: 'org-2',
          role: 'owner',
          createdAt: '2026-03-22T00:00:00.000Z',
        },
      ],
    );
    const updateRes = await app.request('/api/admin/memberships/m-2/role', {
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
        'x-role': 'admin',
      },
      body: JSON.stringify({ role: 'owner' }),
    });
    expect(updateRes.status).toBe(200);

    enqueueDb(
      [{ id: 'm-owner', userId: 'u-1', organizationId: 'org-1', role: 'owner' }],
      [{ total: 1 }],
    );
    const demoteLastOwnerRes = await app.request('/api/admin/memberships/m-owner/role', {
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
        'x-role': 'admin',
      },
      body: JSON.stringify({ role: 'member' }),
    });
    expect(demoteLastOwnerRes.status).toBe(409);

    enqueueDb([{ id: 'm-2', userId: 'u-1', organizationId: 'org-2', role: 'member' }], []);
    const deleteRes = await app.request('/api/admin/memberships/m-2', {
      method: 'DELETE',
      headers: { 'x-role': 'admin' },
    });
    expect(deleteRes.status).toBe(204);

    enqueueDb(
      [{ id: 'm-owner', userId: 'u-1', organizationId: 'org-1', role: 'owner' }],
      [{ total: 1 }],
    );
    const deleteLastOwnerRes = await app.request('/api/admin/memberships/m-owner', {
      method: 'DELETE',
      headers: { 'x-role': 'admin' },
    });
    expect(deleteLastOwnerRes.status).toBe(409);
  });

  it('admin users API forbids non-admin access', async () => {
    const app = createApp();

    const res = await app.request('/api/admin/users', {
      headers: { 'x-role': 'member' },
    });

    expect(res.status).toBe(403);
  });

  it('GET /api/editions/:id/submissions includes participation.universityName', async () => {
    const app = createApp();

    enqueueDb(
      [{ total: 1 }],
      [
        {
          submission: {
            id: 's1',
            templateId: 't1',
            participationId: 'p1',
            submittedBy: 'user-1',
            version: 1,
            fileS3Key: null,
            fileName: 'concept.pdf',
            fileSizeBytes: null,
            fileMimeType: null,
            url: null,
            createdAt: '2026-03-20T00:00:00.000Z',
            updatedAt: '2026-03-20T00:00:00.000Z',
          },
          participation: {
            id: 'p1',
            editionId: 'e1',
            universityId: 'org-1',
            universityName: 'Org One',
            teamName: 'Team A',
            createdAt: '2026-03-20T00:00:00.000Z',
          },
        },
      ],
    );

    const res = await app.request(
      '/api/editions/00000000-0000-0000-0000-000000000001/submissions?templateId=20000000-0000-0000-0000-000000000001',
      {
        headers: { 'x-role': 'member', 'x-organization-id': 'org-1' },
      },
    );

    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      data: Array<{ participation: { universityName?: string } }>;
    };
    expect(json.data[0]?.participation.universityName).toBe('Org One');
    expect(mockCanViewOtherSubmissionsByTemplate).toHaveBeenCalledWith(
      'member-user',
      '00000000-0000-0000-0000-000000000001',
      '20000000-0000-0000-0000-000000000001',
      'org-1',
    );
  });

  it('GET /api/editions/:id/submissions returns 400 when templateId is missing', async () => {
    const app = createApp();

    const res = await app.request(
      '/api/editions/00000000-0000-0000-0000-000000000001/submissions',
      {
        headers: { 'x-role': 'member', 'x-organization-id': 'org-1' },
      },
    );

    expect(res.status).toBe(400);
    const body = (await res.json()) as { error?: unknown };
    expect(body.error).toBeDefined();
    expect(mockCanViewOtherSubmissionsByTemplate).not.toHaveBeenCalled();
  });

  it('GET /api/submissions/:id/history returns submittedByUser with id and name', async () => {
    const app = createApp();

    enqueueDb(
      [{ participationId: '10000000-0000-0000-0000-000000000001' }],
      [{ total: 1 }],
      [
        {
          id: '30000000-0000-0000-0000-000000000001',
          submissionId: '20000000-0000-0000-0000-000000000001',
          version: 1,
          submittedBy: 'user-1',
          submittedByUser: {
            id: 'user-1',
            name: 'Alice',
          },
          fileS3Key: null,
          fileName: 'concept-v1.pdf',
          fileSizeBytes: null,
          fileMimeType: null,
          url: null,
          createdAt: '2026-03-20T00:00:00.000Z',
        },
      ],
    );

    const res = await app.request('/api/submissions/20000000-0000-0000-0000-000000000001/history', {
      headers: { 'x-role': 'member', 'x-organization-id': 'org-1' },
    });

    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      data: Array<{
        submittedBy: string;
        submittedByUser: { id: string; name: string };
      }>;
    };
    expect(json.data[0]?.submittedBy).toBe('user-1');
    expect(json.data[0]?.submittedByUser).toEqual({
      id: 'user-1',
      name: 'Alice',
    });
  });

  it('GET /api/participations/:id/comments includes author universityName and teamName', async () => {
    const app = createApp();

    enqueueDb(
      [{ total: 1 }],
      [
        {
          id: '40000000-0000-0000-0000-000000000001',
          participationId: '10000000-0000-0000-0000-000000000001',
          editionId: '00000000-0000-0000-0000-000000000001',
          body: 'Looks good',
          createdAt: '2026-03-20T00:00:00.000Z',
          updatedAt: '2026-03-20T00:00:00.000Z',
          authorId: 'user-1',
          authorName: 'Alice',
          universityName: 'Org One',
          teamName: 'Team A',
        },
      ],
    );

    const res = await app.request(
      '/api/participations/10000000-0000-0000-0000-000000000001/comments',
      {
        headers: { 'x-role': 'member', 'x-organization-id': 'org-1' },
      },
    );

    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      data: Array<{
        author: {
          id: string;
          name: string;
          universityName: string | null;
          teamName: string | null;
        };
      }>;
    };
    expect(json.data[0]?.author).toEqual({
      id: 'user-1',
      name: 'Alice',
      universityName: 'Org One',
      teamName: 'Team A',
    });
  });

  it('GET /api/participations/:id/submissions returns paginated rows', async () => {
    const app = createApp();

    enqueueDb(
      [{ id: '10000000-0000-0000-0000-000000000001' }],
      [{ total: 1 }],
      [
        {
          id: '30000000-0000-0000-0000-000000000001',
          templateId: '20000000-0000-0000-0000-000000000001',
          templateName: 'Concept',
          templateAcceptType: 'file',
          version: 2,
          fileName: 'concept-v2.pdf',
          url: null,
          updatedAt: '2026-03-20T12:00:00.000Z',
        },
      ],
    );

    const res = await app.request(
      '/api/participations/10000000-0000-0000-0000-000000000001/submissions?page=1&pageSize=10',
      {
        headers: { 'x-role': 'member', 'x-organization-id': 'org-1' },
      },
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      data: [
        {
          id: '30000000-0000-0000-0000-000000000001',
          template: {
            id: '20000000-0000-0000-0000-000000000001',
            name: 'Concept',
            acceptType: 'file',
          },
          version: 2,
          fileName: 'concept-v2.pdf',
          url: null,
          updatedAt: '2026-03-20T12:00:00.000Z',
        },
      ],
      pagination: {
        page: 1,
        pageSize: 10,
        total: 1,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      },
    });
  });

  it('GET /api/admin/editions/:id/participations returns paginated rows', async () => {
    const app = createApp();

    enqueueDb(
      [{ total: 1 }],
      [
        {
          id: '10000000-0000-0000-0000-000000000001',
          editionId: '00000000-0000-0000-0000-000000000001',
          universityId: 'org-1',
          universityName: 'Org One',
          teamName: 'Team A',
          createdAt: '2026-03-20T00:00:00.000Z',
        },
      ],
    );

    const res = await app.request(
      '/api/admin/editions/00000000-0000-0000-0000-000000000001/participations?page=1&pageSize=10',
      {
        headers: { 'x-role': 'admin' },
      },
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      data: [
        {
          id: '10000000-0000-0000-0000-000000000001',
          editionId: '00000000-0000-0000-0000-000000000001',
          universityId: 'org-1',
          universityName: 'Org One',
          teamName: 'Team A',
          createdAt: '2026-03-20T00:00:00.000Z',
        },
      ],
      pagination: {
        page: 1,
        pageSize: 10,
        total: 1,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      },
    });
  });

  it('POST /api/submissions rejects s3Key outside the submission context', async () => {
    const app = createApp();

    enqueueDb(
      [{ id: '10000000-0000-0000-0000-000000000001' }],
      [
        {
          template: {
            id: '20000000-0000-0000-0000-000000000001',
            editionId: '30000000-0000-0000-0000-000000000001',
            acceptType: 'file',
            allowedExtensions: ['pdf'],
            maxFileSizeMb: 5,
            urlPattern: null,
          },
          edition: {
            id: '30000000-0000-0000-0000-000000000001',
            sharingStatus: 'accepting',
          },
          participationId: '10000000-0000-0000-0000-000000000001',
        },
      ],
      [],
    );

    const res = await app.request('/api/submissions', {
      method: 'POST',
      headers: { 'x-role': 'member', 'x-organization-id': 'org-1' },
      body: JSON.stringify({
        templateId: '20000000-0000-0000-0000-000000000001',
        participationId: '10000000-0000-0000-0000-000000000001',
        s3Key:
          'submissions/30000000-0000-0000-0000-000000000001/another-participation/20000000-0000-0000-0000-000000000001/v1_123e4567-e89b-12d3-a456-426614174000_concept.pdf',
        fileName: 'concept.pdf',
        fileSizeBytes: 1024,
        mimeType: 'application/pdf',
      }),
    });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: 's3Key is invalid for this submission context',
    });
  });

  it('POST /api/participations/:id/comments stores author affiliation snapshot', async () => {
    const app = createApp();

    enqueueDb(
      [
        {
          editionId: '00000000-0000-0000-0000-000000000001',
          universityId: 'org-1',
        },
      ],
      [{ name: 'Org One' }],
      [{ teamName: 'Team A' }],
      [
        {
          id: '40000000-0000-0000-0000-000000000001',
          participationId: '10000000-0000-0000-0000-000000000001',
          editionId: '00000000-0000-0000-0000-000000000001',
          authorId: 'member-user',
          authorUniversityName: 'Org One',
          authorTeamName: 'Team A',
          body: 'Looks good',
          createdAt: '2026-03-20T00:00:00.000Z',
          updatedAt: '2026-03-20T00:00:00.000Z',
          deletedAt: null,
        },
      ],
    );

    const res = await app.request(
      '/api/participations/10000000-0000-0000-0000-000000000001/comments',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-role': 'member',
          'x-organization-id': 'org-1',
        },
        body: JSON.stringify({ body: 'Looks good' }),
      },
    );

    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({
      data: {
        id: '40000000-0000-0000-0000-000000000001',
        participationId: '10000000-0000-0000-0000-000000000001',
        editionId: '00000000-0000-0000-0000-000000000001',
        authorId: 'member-user',
        authorUniversityName: 'Org One',
        authorTeamName: 'Team A',
        body: 'Looks good',
        createdAt: '2026-03-20T00:00:00.000Z',
        updatedAt: '2026-03-20T00:00:00.000Z',
        deletedAt: null,
      },
    });

    const insertBuilder = mockDb.insert.mock.results[0]?.value as
      | {
          values: ReturnType<typeof vi.fn>;
        }
      | undefined;
    expect(insertBuilder?.values).toHaveBeenCalledWith({
      participationId: '10000000-0000-0000-0000-000000000001',
      editionId: '00000000-0000-0000-0000-000000000001',
      authorId: 'member-user',
      authorUniversityName: 'Org One',
      authorTeamName: 'Team A',
      body: 'Looks good',
    });
  });

  it('OpenAPI includes new paths', async () => {
    const app = createApp();
    const res = await app.request('/api/openapi.json');

    expect(res.status).toBe(200);
    const json = (await res.json()) as { paths: Record<string, unknown> };

    expect(json.paths['/api/me']).toBeDefined();
    expect(json.paths['/api/editions/{id}/my-participations']).toBeDefined();
    expect(json.paths['/api/editions/{id}/my-submission-status']).toBeDefined();
    expect(json.paths['/api/participations/{id}']).toBeDefined();
    expect(json.paths['/api/participations/{id}/submissions']).toBeDefined();
    expect(json.paths['/api/participations/{id}/comments']).toBeDefined();
    expect(json.paths['/api/comments/{id}']).toBeDefined();
    expect(json.paths['/api/submissions/{id}']).toBeDefined();
    expect(json.paths['/api/submissions/{id}/download']).toBeDefined();
    expect(json.paths['/api/submission-history/{historyId}/download']).toBeDefined();
    expect(json.paths['/api/upload/presign']).toBeDefined();
    expect(json.paths['/api/admin/editions/{id}/participations']).toBeDefined();
    expect(json.paths['/api/admin/participations/{id}']).toBeDefined();
    expect(json.paths['/api/admin/series']).toBeDefined();
    expect(json.paths['/api/admin/series/{id}']).toBeDefined();
    expect(json.paths['/api/admin/editions/{id}']).toBeDefined();
    expect(json.paths['/api/admin/editions/{id}/rules/presign']).toBeDefined();
    expect(json.paths['/api/admin/editions/{id}/rules']).toBeDefined();
    expect(json.paths['/api/university/members/{id}/role']).toBeDefined();
    expect(json.paths['/api/university/members/{id}']).toBeDefined();
    expect(json.paths['/api/admin/users']).toBeDefined();
    expect(json.paths['/api/admin/users/{userId}/memberships']).toBeDefined();
    expect(json.paths['/api/admin/memberships/{memberId}/role']).toBeDefined();
    expect(json.paths['/api/admin/memberships/{memberId}']).toBeDefined();

    const myParticipationsPath = json.paths['/api/editions/{id}/my-participations'] as {
      get?: { responses?: Record<string, unknown> };
    };
    expect(myParticipationsPath.get?.responses?.['403']).toBeDefined();

    const mySubmissionStatusPath = json.paths['/api/editions/{id}/my-submission-status'] as {
      get?: { responses?: Record<string, unknown> };
    };
    expect(mySubmissionStatusPath.get?.responses?.['403']).toBeDefined();

    const commentDetailPath = json.paths['/api/comments/{id}'] as {
      put?: { responses?: Record<string, unknown> };
      delete?: { responses?: Record<string, unknown> };
    };
    expect(commentDetailPath.put?.responses?.['200']).toBeDefined();
    expect(commentDetailPath.delete?.responses?.['204']).toBeDefined();
  });
});
