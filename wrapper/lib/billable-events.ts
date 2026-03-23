import { randomUUID } from "node:crypto";
import {
  settleCompletedBillableItem,
  type BillableItemSettlementInput,
} from "@/lib/billing-policy";

type InsertBillableEventInput = {
  id: string;
  workspaceId: string;
  ventureId: string | null;
  runId: string | null;
  eventType: string;
  productKey: string;
  creditsCost: number;
  idempotencyKey: string;
  approvalGateId: string | null;
  metadataJson: unknown;
  createdAt: string;
  settledAt: string | null;
};

type InsertCreditLedgerEntryInput = {
  id: string;
  workspaceId: string;
  ventureId: string | null;
  eventKind: string;
  creditsDelta: number;
  euroCostCents: number;
  providerCostCents: number;
  note: string | null;
  metadataJson: unknown;
  createdAt: string;
};

type BillableEventSettlementDependencies = {
  insertBillableEvent(input: InsertBillableEventInput): Promise<string | null>;
  insertCreditLedgerEntry(input: InsertCreditLedgerEntryInput): Promise<void>;
};

type BillableEventSettlementRequest = BillableItemSettlementInput & {
  workspaceId: string;
  ventureId?: string | null;
  runId?: string | null;
  idempotencyKey: string;
  approvalGateId?: string | null;
  createdAt?: string;
};

export async function recordBillableEventSettlement(
  deps: BillableEventSettlementDependencies,
  input: BillableEventSettlementRequest,
) {
  const settlement = settleCompletedBillableItem(input);
  if (!settlement) {
    return { status: "ignored" as const };
  }

  const createdAt = input.createdAt ?? new Date().toISOString();
  const billableEventId =
    (await deps.insertBillableEvent({
      id: input.billableEventId,
      workspaceId: input.workspaceId,
      ventureId: input.ventureId ?? null,
      runId: input.runId ?? null,
      eventType: input.billableKind,
      productKey: input.productKey,
      creditsCost: settlement.creditsCost,
      idempotencyKey: input.idempotencyKey,
      approvalGateId: input.approvalGateId ?? null,
      metadataJson: {
        billingPolicyVersion: settlement.policyVersion,
      },
      createdAt,
      settledAt: createdAt,
    })) ?? null;

  if (!billableEventId) {
    return {
      status: "duplicate" as const,
      billableEventId: input.billableEventId,
    };
  }

  await deps.insertCreditLedgerEntry({
    id: `ledger_${randomUUID()}`,
    workspaceId: input.workspaceId,
    ventureId: input.ventureId ?? null,
    eventKind: settlement.ledgerEntry.eventKind,
    creditsDelta: settlement.ledgerEntry.creditsDelta,
    euroCostCents: 0,
    providerCostCents: 0,
    note: settlement.ledgerEntry.note,
    metadataJson: {
      billingPolicyVersion: settlement.policyVersion,
      billableEventId: input.billableEventId,
      idempotencyKey: input.idempotencyKey,
    },
    createdAt,
  });

  return {
    status: "settled" as const,
    billableEventId,
  };
}
