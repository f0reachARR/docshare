import type { Next } from "hono";
import { HTTPException } from "hono/http-exception";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetSession = vi.fn();
type UserRow = {
  id: string;
  email: string;
  name: string;
  isAdmin: boolean;
};
const mockLimit = vi.fn<() => Promise<UserRow[]>>(async () => []);

vi.mock('../auth.js', () => ({
  auth: {
    api: {
      getSession: mockGetSession,
    },
  },
}));

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

const { requireAuth } = await import('./auth.js');

type TestContext = {
  req: {
    raw: Request;
  };
  set: (key: string, value: unknown) => void;
  get: (key: string) => unknown;
};

const createContext = (headers?: Record<string, string>): TestContext => {
  const vars = new Map<string, unknown>();

  return {
    req: {
      raw: new Request("http://localhost/test", {
        headers,
      }),
    },
    set: (key, value) => {
      vars.set(key, value);
    },
    get: (key) => vars.get(key),
  };
};

describe("requireAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLimit.mockResolvedValue([]);
  });

  it("セッションなしは401", async () => {
    const c = createContext();
    mockGetSession.mockResolvedValue(null);

    await expect(
      requireAuth(c as never, vi.fn() as Next),
    ).rejects.toBeInstanceOf(HTTPException);
  });

  it("有効セッション時にcurrentUserとactiveOrganizationを設定", async () => {
    const c = createContext({ cookie: "better-auth.session_token=test" });
    const next = vi.fn(async () => undefined);

    mockGetSession.mockResolvedValue({
      user: { id: "user-1" },
      session: { activeOrganizationId: "org-1" },
    });
    mockLimit.mockResolvedValue([
      {
        id: "user-1",
        email: "u@example.com",
        name: "user",
        isAdmin: false,
      },
    ]);

    await requireAuth(c as never, next as Next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(c.get("currentUser")).toEqual({
      id: "user-1",
      email: "u@example.com",
      name: "user",
      isAdmin: false,
    });
    expect(c.get("sessionActiveOrganizationId")).toBe("org-1");
  });
});
