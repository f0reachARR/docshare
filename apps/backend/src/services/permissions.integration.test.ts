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
    where: ReturnType<typeof vi.fn>;
    limit: ReturnType<typeof vi.fn>;
    then: <TResult1 = DbQueueItem, TResult2 = never>(
      onfulfilled?: ((value: DbQueueItem) => TResult1 | PromiseLike<TResult1>) | null,
      onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
    ) => Promise<TResult1 | TResult2>;
  } = {
    from: vi.fn(() => builder),
    innerJoin: vi.fn(() => builder),
    where: vi.fn(() => builder),
    limit: vi.fn(async () => dequeueDb()),
    // biome-ignore lint/suspicious/noThenProperty: Test double emulates Drizzle's awaitable query builder.
    then: (onfulfilled, onrejected) => dequeueDb().then(onfulfilled, onrejected),
  };

  return builder;
};

vi.mock('../db/index.js', () => ({
  db: {
    select: vi.fn(() => createAwaitableBuilder()),
  },
}));

const {
  canViewParticipationWithReason,
  canViewOtherSubmissionsByTemplate,
  isAdmin,
  getUserUniversityIds,
} = await import('./permissions.js');

describe('permissions integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbQueue.length = 0;
  });

  it('admin は participation/template 文脈に関係なく閲覧可能', async () => {
    enqueueDb([{ isAdmin: true }]);

    const decision = await canViewParticipationWithReason(
      'admin-user',
      '10000000-0000-0000-0000-000000000001',
      null,
      undefined,
    );

    expect(decision).toEqual({ allowed: true });
  });

  it('templateId なしで他大学 participation を閲覧しようとすると拒否される', async () => {
    enqueueDb(
      [{ isAdmin: false }],
      [
        {
          id: '10000000-0000-0000-0000-000000000001',
          editionId: '00000000-0000-0000-0000-000000000010',
          universityId: 'org-target',
        },
      ],
      [{ organizationId: 'org-self' }],
    );

    const decision = await canViewParticipationWithReason(
      'member-user',
      '10000000-0000-0000-0000-000000000001',
      'org-self',
      undefined,
    );

    expect(decision).toEqual({ allowed: false, reason: 'template_context_required' });
  });

  it('条件1: organization context 未指定なら拒否', async () => {
    enqueueDb([{ isAdmin: false }]);

    const decision = await canViewOtherSubmissionsByTemplate(
      'member-user',
      '00000000-0000-0000-0000-000000000010',
      '20000000-0000-0000-0000-000000000010',
      null,
    );

    expect(decision).toEqual({ allowed: false, reason: 'organization_context_required' });
  });

  it('条件2: sharing_status が sharing/closed 以外なら拒否', async () => {
    enqueueDb([{ isAdmin: false }], [{ sharingStatus: 'accepting' }]);

    const decision = await canViewOtherSubmissionsByTemplate(
      'member-user',
      '00000000-0000-0000-0000-000000000010',
      '20000000-0000-0000-0000-000000000010',
      'org-self',
    );

    expect(decision).toEqual({ allowed: false, reason: 'sharing_status_not_viewable' });
  });

  it('条件3: 選択組織が大会参加していなければ拒否', async () => {
    enqueueDb([{ isAdmin: false }], [{ sharingStatus: 'sharing' }], []);

    const decision = await canViewOtherSubmissionsByTemplate(
      'member-user',
      '00000000-0000-0000-0000-000000000010',
      '20000000-0000-0000-0000-000000000010',
      'org-self',
    );

    expect(decision).toEqual({ allowed: false, reason: 'organization_not_participating' });
  });

  it('条件4: 選択組織が template 未提出なら拒否', async () => {
    enqueueDb(
      [{ isAdmin: false }],
      [{ sharingStatus: 'sharing' }],
      [{ id: 'p-self' }],
      [{ value: 0 }],
    );

    const decision = await canViewOtherSubmissionsByTemplate(
      'member-user',
      '00000000-0000-0000-0000-000000000010',
      '20000000-0000-0000-0000-000000000010',
      'org-self',
    );

    expect(decision).toEqual({ allowed: false, reason: 'template_not_submitted' });
  });

  it('全条件を満たせば閲覧可能', async () => {
    enqueueDb(
      [{ isAdmin: false }],
      [{ sharingStatus: 'closed' }],
      [{ id: 'p-self' }],
      [{ value: 1 }],
    );

    const decision = await canViewOtherSubmissionsByTemplate(
      'member-user',
      '00000000-0000-0000-0000-000000000010',
      '20000000-0000-0000-0000-000000000010',
      'org-self',
    );

    expect(decision).toEqual({ allowed: true });
  });

  it('admin 特例: canViewOtherSubmissionsByTemplate は常に許可', async () => {
    enqueueDb([{ isAdmin: true }]);

    const decision = await canViewOtherSubmissionsByTemplate(
      'admin-user',
      '00000000-0000-0000-0000-000000000010',
      '20000000-0000-0000-0000-000000000010',
      null,
    );

    expect(decision).toEqual({ allowed: true });
  });

  it('組織切替で判定が変わる（未参加 org -> 参加 org）', async () => {
    enqueueDb(
      [{ isAdmin: false }],
      [{ sharingStatus: 'sharing' }],
      [],
      [{ isAdmin: false }],
      [{ sharingStatus: 'sharing' }],
      [{ id: 'p-self' }],
      [{ value: 1 }],
    );

    const denied = await canViewOtherSubmissionsByTemplate(
      'member-user',
      '00000000-0000-0000-0000-000000000010',
      '20000000-0000-0000-0000-000000000010',
      'org-not-joined',
    );
    const allowed = await canViewOtherSubmissionsByTemplate(
      'member-user',
      '00000000-0000-0000-0000-000000000010',
      '20000000-0000-0000-0000-000000000010',
      'org-self',
    );

    expect(denied).toEqual({ allowed: false, reason: 'organization_not_participating' });
    expect(allowed).toEqual({ allowed: true });
  });

  it('ヘルパー経由でも DB 統合で値が返る', async () => {
    enqueueDb([{ isAdmin: false }], [{ organizationId: 'org-a' }, { organizationId: 'org-b' }]);

    const admin = await isAdmin('member-user');
    const ids = await getUserUniversityIds('member-user');

    expect(admin).toBe(false);
    expect(ids).toEqual(['org-a', 'org-b']);
  });
});
