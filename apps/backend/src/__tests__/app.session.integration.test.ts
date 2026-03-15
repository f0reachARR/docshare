import { describe, expect, it, vi } from "vitest";

const mockGetSession = vi.fn();
type UserRow = {
  id: string;
  email: string;
  name: string;
  isAdmin: boolean;
};
const mockUserLimit = vi.fn<() => Promise<UserRow[]>>(async () => []);

vi.mock('../auth.js', () => ({
  auth: {
    api: {
      getSession: mockGetSession,
    },
    handler: vi.fn(async () => new Response("Not Found", { status: 404 })),
  },
}));

vi.mock('../db/index.js', () => ({
  db: {
    select: vi.fn(() => ({
      from: () => ({
        where: () => ({
          limit: mockUserLimit,
        }),
      }),
    })),
  },
}));

const { createApp } = await import('../app.js');

describe("app session integration", () => {
  it("セッションなしは認証必須APIで401", async () => {
    const app = createApp();
    mockGetSession.mockResolvedValueOnce(null);

    const res = await app.request("/api/submissions", {
      method: "POST",
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(401);
  });

  it("セッションありは認証を通過し、後段バリデーションが動作", async () => {
    const app = createApp();
    mockGetSession.mockResolvedValueOnce({
      user: { id: "user-1" },
      session: {},
    });
    mockUserLimit.mockResolvedValueOnce([
      {
        id: "user-1",
        email: "u@example.com",
        name: "user",
        isAdmin: false,
      },
    ]);

    const res = await app.request("/api/submissions", {
      method: "POST",
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(400);
  });
});
