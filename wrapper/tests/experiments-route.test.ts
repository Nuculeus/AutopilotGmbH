import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
const createExperimentForUserMock = vi.fn();

vi.mock("@clerk/nextjs/server", () => ({
  auth: authMock,
}));

vi.mock("@/lib/control-plane-store", () => ({
  createExperimentForUser: createExperimentForUserMock,
}));

describe("POST /api/experiments", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    authMock.mockResolvedValue({ userId: null });

    const { POST } = await import("@/app/api/experiments/route");
    const response = await POST(
      new Request("http://localhost/api/experiments", {
        method: "POST",
      }),
    );

    expect(response.status).toBe(401);
  });

  it("creates an experiment with variants", async () => {
    authMock.mockResolvedValue({ userId: "user_123" });
    createExperimentForUserMock.mockResolvedValue({
      experiment: { id: "exp_1", ventureId: "v1", status: "draft" },
      variants: [
        { id: "var_1", label: "A" },
        { id: "var_2", label: "B" },
      ],
    });

    const { POST } = await import("@/app/api/experiments/route");
    const response = await POST(
      new Request("http://localhost/api/experiments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ventureId: "v1",
          hypothesis: "Klarer Nutzen-Claim steigert Antwortquote.",
          targetMetric: "reply_rate",
          variants: [
            { label: "A", payload: { headline: "Automatisierter Support fuer KMU" } },
            { label: "B", payload: { headline: "24/7 Voice-Rezeption fuer Handwerk" } },
          ],
        }),
      }),
    );

    expect(response.status).toBe(201);
    expect(createExperimentForUserMock).toHaveBeenCalledWith({
      clerkUserId: "user_123",
      input: expect.objectContaining({
        ventureId: "v1",
        targetMetric: "reply_rate",
      }),
    });
  });
});
