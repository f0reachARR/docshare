import type { Next } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockLimit = vi.fn<() => Promise<Array<{ organizationId: string }>>>(async () => []);

vi.mock('../db/index.js', () => ({
  db: {
    select: vi.fn(() => ({
      from: () => ({
        where: () => ({
          limit: mockLimit,
        }),
      }),
    })),
  },
}));

const { resolveOrganization } = await import('./organization.js');

type TestContext = {
  req: {
    header: (name: string) => string | undefined;
  };
  get: (key: string) => unknown;
  set: (key: string, value: unknown) => void;
};

const createContext = (params: {
  user: { id: string; isAdmin: boolean };
  headerOrganizationId?: string;
  sessionActiveOrganizationId?: string | null;
}): TestContext => {
  const vars = new Map<string, unknown>();
  vars.set('currentUser', params.user);
  vars.set('session', { activeOrganizationId: params.sessionActiveOrganizationId ?? null });

  return {
    req: {
      header: (name) => {
        if (name.toLowerCase() === 'x-organization-id') {
          return params.headerOrganizationId;
        }
        return undefined;
      },
    },
    get: (key) => vars.get(key),
    set: (key, value) => {
      vars.set(key, value);
    },
  };
};

describe('resolveOrganization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLimit.mockResolvedValue([]);
  });

  it('セッションactiveOrganizationを優先して利用する', async () => {
    const c = createContext({
      user: { id: 'user-1', isAdmin: false },
      headerOrganizationId: 'org-1',
      sessionActiveOrganizationId: 'org-1',
    });
    mockLimit.mockResolvedValue([{ organizationId: 'org-1' }]);

    await resolveOrganization(c as never, vi.fn(async () => undefined) as Next);

    expect(c.get('organizationId')).toBe('org-1');
  });

  it('互換層としてセッション未設定時はヘッダーを利用する', async () => {
    const c = createContext({
      user: { id: 'user-1', isAdmin: false },
      headerOrganizationId: 'org-header',
      sessionActiveOrganizationId: null,
    });
    mockLimit.mockResolvedValue([{ organizationId: 'org-header' }]);

    await resolveOrganization(c as never, vi.fn(async () => undefined) as Next);

    expect(c.get('organizationId')).toBe('org-header');
  });

  it('セッションとヘッダーが不一致の場合は403', async () => {
    const c = createContext({
      user: { id: 'user-1', isAdmin: false },
      headerOrganizationId: 'org-header',
      sessionActiveOrganizationId: 'org-1',
    });

    await expect(
      resolveOrganization(c as never, vi.fn(async () => undefined) as Next),
    ).rejects.toBeInstanceOf(HTTPException);
  });

  it('所属していないorganization指定は403', async () => {
    const c = createContext({
      user: { id: 'user-1', isAdmin: false },
      headerOrganizationId: 'org-x',
      sessionActiveOrganizationId: null,
    });

    await expect(
      resolveOrganization(c as never, vi.fn(async () => undefined) as Next),
    ).rejects.toBeInstanceOf(HTTPException);
  });

  it('organizationコンテキスト未指定時はnull', async () => {
    const c = createContext({
      user: { id: 'admin-1', isAdmin: true },
    });

    await resolveOrganization(c as never, vi.fn(async () => undefined) as Next);

    expect(c.get('organizationId')).toBeNull();
  });
});
