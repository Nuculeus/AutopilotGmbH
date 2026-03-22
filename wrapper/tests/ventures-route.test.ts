import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
const createVentureForUserMock = vi.fn();

vi.mock("@clerk/nextjs/server", () => ({
  auth: authMock,
}));

vi.mock("@/lib/control-plane-store", () => ({
  createVentureForUser: createVentureForUserMock,
}));

describe("POST /api/ventures", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    authMock.mockResolvedValue({ userId: null });

    const { POST } = await import("@/app/api/ventures/route");
    const response = await POST(
      new Request("http://localhost/api/ventures", {
        method: "POST",
      }),
    );

    expect(response.status).toBe(401);
    expect(createVentureForUserMock).not.toHaveBeenCalled();
  });

  it("creates a venture for the signed-in user", async () => {
    authMock.mockResolvedValue({ userId: "user_123" });
    createVentureForUserMock.mockResolvedValue({
      id: "venture_1",
      workspaceId: "ws_1",
      name: "Autopilot Service Sprint",
      revenueTrack: "service_business",
      status: "active",
    });

    const { POST } = await import("@/app/api/ventures/route");
    const response = await POST(
      new Request("http://localhost/api/ventures", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Autopilot Service Sprint",
          revenueTrack: "service_business",
        }),
      }),
    );

    expect(response.status).toBe(201);
    expect(createVentureForUserMock).toHaveBeenCalledWith({
      clerkUserId: "user_123",
      name: "Autopilot Service Sprint",
      revenueTrack: "service_business",
    });
  });
});
