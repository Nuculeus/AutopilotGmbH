import { describe, expect, it } from "vitest";
import {
  appendCreditLedgerEntry,
  markStripeEventProcessed,
  normalizeCreditMetadata,
  summarizeCredits,
  type CreditMetadata,
} from "@/lib/credits";

describe("credit ledger", () => {
  it("derives available credits from immutable ledger entries", () => {
    let state = normalizeCreditMetadata({
      plan: "free",
      creditLedgerEntries: [],
    } satisfies CreditMetadata);

    state = appendCreditLedgerEntry(state, {
      id: "entry_grant_launch",
      eventKind: "grant",
      creditsDelta: 100,
      euroCostCents: 0,
      providerCostCents: 0,
      note: "launch_bonus",
      createdAt: "2026-03-22T10:00:00.000Z",
    });
    state = appendCreditLedgerEntry(state, {
      id: "entry_run_debit",
      eventKind: "debit",
      creditsDelta: -18,
      euroCostCents: 0,
      providerCostCents: 240,
      note: "service_offer_iteration",
      createdAt: "2026-03-22T10:05:00.000Z",
    });
    state = appendCreditLedgerEntry(state, {
      id: "entry_reversal",
      eventKind: "technical_reversal",
      creditsDelta: 18,
      euroCostCents: 0,
      providerCostCents: 0,
      note: "retry_after_infrastructure_failure",
      createdAt: "2026-03-22T10:06:00.000Z",
    });

    const summary = summarizeCredits(state);

    expect(summary.availableCredits).toBe(120);
    expect(summary.consumedCredits).toBe(0);
    expect(summary.manualCredits).toBe(118);
    expect(summary.grantedCredits).toBe(118);
    expect(summary.debitedCredits).toBe(18);
    expect(summary.reversedCredits).toBe(18);
    expect(summary.ledgerBacked).toBe(true);
  });

  it("keeps legacy counter metadata readable while the ledger migration is in progress", () => {
    const summary = summarizeCredits({
      plan: "starter",
      manualCredits: 12,
      consumedCredits: 7,
    } satisfies CreditMetadata);

    expect(summary.availableCredits).toBe(75);
    expect(summary.monthlyPlanCredits).toBe(50);
    expect(summary.manualCredits).toBe(12);
    expect(summary.consumedCredits).toBe(7);
    expect(summary.grantedCredits).toBe(12);
    expect(summary.debitedCredits).toBe(7);
    expect(summary.reversedCredits).toBe(0);
    expect(summary.ledgerBacked).toBe(false);
  });

  it("tracks processed stripe events idempotently", () => {
    const once = markStripeEventProcessed(
      normalizeCreditMetadata(null),
      "evt_checkout_123",
    );
    const twice = markStripeEventProcessed(once, "evt_checkout_123");

    expect(twice.processedStripeEventIds).toEqual(["evt_checkout_123"]);
  });
});
