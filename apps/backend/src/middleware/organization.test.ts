import type { Next } from "hono";
import { HTTPException } from "hono/http-exception";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockLimit = vi.fn<() => Promise<Array<{ id: string }>>>(async () => []);

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
  vars.set("currentUser", params.user);
  vars.set(
    "sessionActiveOrganizationId",
    params.sessionActiveOrganizationId ?? null,
  );

  return {
    req: {
      header: (name) => {
        if (name.toLowerCase() === "x-organization-id") {
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

describe("resolveOrganization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLimit.mockResolvedValue([]);
  });

  it("ヘッダー未指定時にセッションactiveOrganizationを利用する", async () => {
    const c = createContext({
      user: { id: "user-1", isAdmin: false },
      sessionActiveOrganizationId: "org-1",
    });
    mockLimit.mockResolvedValue([{ id: "m-1" }]);

    await resolveOrganization(c as never, vi.fn(async () => undefined) as Next);

    expect(c.get("organizationId")).toBe("org-1");
  });

  it("所属していないorganization指定は403", async () => {
    const c = createContext({
      user: { id: "user-1", isAdmin: false },
      headerOrganizationId: "org-x",
      sessionActiveOrganizationId: "org-1",
    });

    await expect(
      resolveOrganization(c as never, vi.fn(async () => undefined) as Next),
    ).rejects.toBeInstanceOf(HTTPException);
  });

  it("organizationコンテキスト未指定時はnull", async () => {
    const c = createContext({
      user: { id: "admin-1", isAdmin: true },
    });

    await resolveOrganization(c as never, vi.fn(async () => undefined) as Next);

    expect(c.get("organizationId")).toBeNull();
  });
});
