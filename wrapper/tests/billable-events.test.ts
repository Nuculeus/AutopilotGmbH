import { describe, expect, it, vi } from "vitest";
import { recordBillableEventSettlement } from "@/lib/billable-events";

describe("billable event settlement", () => {
  it("writes one billable event and one ledger debit for a completed product package", async () => {
    const insertBillableEvent = vi.fn(async () => "bill_evt_1");
    const insertCreditLedgerEntry = vi.fn(async () => undefined);

    const result = await recordBillableEventSettlement(
      {
        insertBillableEvent,
        insertCreditLedgerEntry,
      },
      {
        workspaceId: "ws_1",
        ventureId: "venture_1",
        runId: "run_1",
        billableEventId: "bill_evt_1",
        billableKind: "auto_product",
        productKey: "offer_sprint_v1",
        status: "completed",
        idempotencyKey: "run_1:offer_sprint_v1",
        createdAt: "2026-03-23T09:00:00.000Z",
      },
    );

    expect(result.status).toBe("settled");
    expect(insertBillableEvent).toHaveBeenCalledOnce();
    expect(insertCreditLedgerEntry).toHaveBeenCalledOnce();
    expect(insertCreditLedgerEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        eventKind: "debit",
        creditsDelta: -12,
        note: "offer_sprint_v1",
      }),
    );
  });

  it("does not debit twice when the same idempotency key is replayed", async () => {
    const insertBillableEvent = vi.fn(async () => null);
    const insertCreditLedgerEntry = vi.fn(async () => undefined);

    const result = await recordBillableEventSettlement(
      {
        insertBillableEvent,
        insertCreditLedgerEntry,
      },
      {
        workspaceId: "ws_1",
        ventureId: "venture_1",
        runId: "run_1",
        billableEventId: "bill_evt_dup",
        billableKind: "auto_product",
        productKey: "offer_sprint_v1",
        status: "completed",
        idempotencyKey: "run_1:offer_sprint_v1",
        createdAt: "2026-03-23T09:00:00.000Z",
      },
    );

    expect(result).toEqual({
      status: "duplicate",
      billableEventId: "bill_evt_dup",
    });
    expect(insertCreditLedgerEntry).not.toHaveBeenCalled();
  });

  it("ignores incomplete work and unapproved extension packs", async () => {
    const insertBillableEvent = vi.fn(async () => "unused");
    const insertCreditLedgerEntry = vi.fn(async () => undefined);

    const failed = await recordBillableEventSettlement(
      {
        insertBillableEvent,
        insertCreditLedgerEntry,
      },
      {
        workspaceId: "ws_1",
        ventureId: "venture_1",
        billableEventId: "bill_evt_failed",
        billableKind: "auto_product",
        productKey: "validation_sprint_v1",
        status: "failed",
        idempotencyKey: "validation_failed",
        createdAt: "2026-03-23T09:05:00.000Z",
      },
    );

    const missingApproval = await recordBillableEventSettlement(
      {
        insertBillableEvent,
        insertCreditLedgerEntry,
      },
      {
        workspaceId: "ws_1",
        ventureId: "venture_1",
        billableEventId: "bill_evt_pack",
        billableKind: "approved_extension_pack",
        productKey: "extra_leads_25_v1",
        status: "completed",
        approvalGranted: false,
        idempotencyKey: "extra_pack_without_approval",
        createdAt: "2026-03-23T09:10:00.000Z",
      },
    );

    expect(failed).toEqual({ status: "ignored" });
    expect(missingApproval).toEqual({ status: "ignored" });
    expect(insertBillableEvent).not.toHaveBeenCalled();
    expect(insertCreditLedgerEntry).not.toHaveBeenCalled();
  });
});
