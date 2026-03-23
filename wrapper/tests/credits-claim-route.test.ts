import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
const getUserMock = vi.fn();
const updateUserMetadataMock = vi.fn();
const recordCreditLedgerEventForUserMock = vi.fn();

vi.mock("@clerk/nextjs/server", () => ({
  auth: authMock,
  clerkClient: vi.fn(async () => ({
    users: {
      getUser: getUserMock,
      updateUserMetadata: updateUserMetadataMock,
    },
  })),
}));

vi.mock("@/lib/credit-ledger-store", () => ({
  recordCreditLedgerEventForUser: recordCreditLedgerEventForUserMock,
}));

describe("POST /api/credits/claim", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("appends an immutable launch bonus grant entry on first claim", async () => {
    authMock.mockResolvedValue({ userId: "user_123" });
    getUserMock.mockResolvedValue({
      publicMetadata: {
        autopilotCredits: {
          plan: "free",
          launchBonusClaimed: false,
          creditLedgerEntries: [],
        },
      },
    });

    const { POST } = await import("@/app/api/credits/claim/route");
    const response = await POST(
      new Request("http://localhost/api/credits/claim", { method: "POST" }),
    );

    expect(response.status).toBe(303);
    expect(updateUserMetadataMock).toHaveBeenCalledWith(
      "user_123",
      expect.objectContaining({
        publicMetadata: expect.objectContaining({
          autopilotCredits: expect.objectContaining({
            launchBonusClaimed: true,
            creditLedgerEntries: expect.arrayContaining([
              expect.objectContaining({
                eventKind: "grant",
                creditsDelta: 100,
                note: "launch_bonus",
              }),
            ]),
          }),
        }),
      }),
    );
    expect(recordCreditLedgerEventForUserMock).toHaveBeenCalledWith({
      clerkUserId: "user_123",
      event: expect.objectContaining({
        eventKind: "grant",
        creditsDelta: 100,
        note: "launch_bonus",
      }),
    });
  });

  it("does not append a second launch bonus entry once already claimed", async () => {
    authMock.mockResolvedValue({ userId: "user_123" });
    getUserMock.mockResolvedValue({
      publicMetadata: {
        autopilotCredits: {
          plan: "launch",
          launchBonusClaimed: true,
          creditLedgerEntries: [
            {
              id: "entry_launch",
              eventKind: "grant",
              creditsDelta: 100,
              euroCostCents: 0,
              providerCostCents: 0,
              note: "launch_bonus",
              createdAt: "2026-03-22T10:00:00.000Z",
            },
          ],
        },
      },
    });

    const { POST } = await import("@/app/api/credits/claim/route");
    const response = await POST(
      new Request("http://localhost/api/credits/claim", { method: "POST" }),
    );

    expect(response.status).toBe(303);
    expect(updateUserMetadataMock).not.toHaveBeenCalled();
    expect(recordCreditLedgerEventForUserMock).not.toHaveBeenCalled();
  });
});
