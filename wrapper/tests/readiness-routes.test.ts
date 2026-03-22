import { beforeEach, describe, expect, it, vi } from "vitest";

const getSystemReadinessMock = vi.fn();

vi.mock("@/lib/readiness", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/readiness")>();
  return {
    ...actual,
    getSystemReadiness: getSystemReadinessMock,
  };
});

describe("health and readiness routes", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("returns a shallow health payload with ok, version, and timestamp", async () => {
    const { GET } = await import("@/app/api/health/route");
    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual(
      expect.objectContaining({
        ok: true,
        version: expect.any(String),
        timestamp: expect.any(String),
      }),
    );
  });

  it("returns integration readiness for db, paperclip, stripe, and secret store", async () => {
    getSystemReadinessMock.mockResolvedValue({
      ok: false,
      version: "test-version",
      timestamp: "2026-03-22T20:00:00.000Z",
      db: { status: "ready", detail: "database configured" },
      paperclip: { status: "degraded", detail: "paperclip probe failed" },
      stripe: { status: "missing", detail: "missing stripe key" },
      secretStore: { status: "ready", detail: "bridge secret configured" },
    });

    const { GET } = await import("@/app/api/ready/route");
    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual(
      expect.objectContaining({
        ok: false,
        db: expect.objectContaining({ status: "ready" }),
        paperclip: expect.objectContaining({ status: "degraded" }),
        stripe: expect.objectContaining({ status: "missing" }),
        secretStore: expect.objectContaining({ status: "ready" }),
      }),
    );
  });
});
