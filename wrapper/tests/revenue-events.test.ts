import { describe, expect, it } from "vitest";
import {
  normalizeAutopilotRevenueMetadata,
  summarizeRevenueStatus,
} from "@/lib/revenue-events";

describe("revenue event helpers", () => {
  it("summarizes billing attention when latest revenue event is payment_failed", () => {
    const revenue = normalizeAutopilotRevenueMetadata({
      firstValueEvent: null,
      revenueEvents: [
        {
          kind: "payment_failed",
          createdAt: "2026-03-21T20:35:00.000Z",
          source: "stripe",
          amountCents: 7900,
          currency: "eur",
          externalRef: "in_456",
        },
      ],
      payoutStatus: {
        status: "pending",
        lastUpdatedAt: "2026-03-21T20:35:00.000Z",
        lastPayoutAt: null,
        note: "invoice_payment_failed",
      },
      updatedAt: "2026-03-21T20:35:00.000Z",
    });

    const summary = summarizeRevenueStatus(revenue);

    expect(summary.billingHealth).toBe("attention");
    expect(summary.payoutStatusLabel).toBe("Auszahlung offen");
  });
});
