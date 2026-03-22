import {
  advanceRevenueMilestone,
  type LaunchRevenueMilestone,
  type RevenueTrack,
} from "@/lib/revenue-track";

export type FirstValueEvent = {
  createdAt: string;
  source: "workspace" | "system";
  summary: string | null;
  revenueTrack: RevenueTrack | null;
};

export type RevenueEvent = {
  kind: "offer_live" | "checkout_live" | "revenue_recorded" | "payment_failed";
  createdAt: string;
  source: "workspace" | "stripe" | "system";
  amountCents: number | null;
  currency: string | null;
  externalRef: string | null;
};

export type PayoutStatus = {
  status: "not_ready" | "pending" | "paid";
  lastUpdatedAt: string | null;
  lastPayoutAt: string | null;
  note: string | null;
};

export type AutopilotRevenueMetadata = {
  firstValueEvent: FirstValueEvent | null;
  revenueEvents: RevenueEvent[];
  processedStripeEventIds: string[];
  payoutStatus: PayoutStatus;
  updatedAt: string | null;
};

export const EMPTY_AUTOPILOT_REVENUE: AutopilotRevenueMetadata = {
  firstValueEvent: null,
  revenueEvents: [],
  processedStripeEventIds: [],
  payoutStatus: {
    status: "not_ready",
    lastUpdatedAt: null,
    lastPayoutAt: null,
    note: null,
  },
  updatedAt: null,
};

function asString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function asNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizePayoutStatus(value: unknown): PayoutStatus {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return EMPTY_AUTOPILOT_REVENUE.payoutStatus;
  }

  const source = value as Record<string, unknown>;
  const status =
    source.status === "pending" || source.status === "paid" ? source.status : "not_ready";

  return {
    status,
    lastUpdatedAt: asString(source.lastUpdatedAt),
    lastPayoutAt: asString(source.lastPayoutAt),
    note: asString(source.note),
  };
}

function normalizeRevenueEvent(value: unknown): RevenueEvent | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const source = value as Record<string, unknown>;
  if (
    source.kind !== "offer_live" &&
    source.kind !== "checkout_live" &&
    source.kind !== "revenue_recorded" &&
    source.kind !== "payment_failed"
  ) {
    return null;
  }

  const createdAt = asString(source.createdAt);
  if (!createdAt) {
    return null;
  }

  const eventSource =
    source.source === "workspace" || source.source === "stripe" ? source.source : "system";

  return {
    kind: source.kind,
    createdAt,
    source: eventSource,
    amountCents: asNumber(source.amountCents),
    currency: asString(source.currency),
    externalRef: asString(source.externalRef),
  };
}

export function normalizeAutopilotRevenueMetadata(
  value: unknown,
): AutopilotRevenueMetadata {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return EMPTY_AUTOPILOT_REVENUE;
  }

  const source = value as Record<string, unknown>;
  const firstValueSource =
    source.firstValueEvent &&
    typeof source.firstValueEvent === "object" &&
    !Array.isArray(source.firstValueEvent)
      ? (source.firstValueEvent as Record<string, unknown>)
      : null;

  const firstValueEvent: FirstValueEvent | null = firstValueSource
    ? {
        createdAt: asString(firstValueSource.createdAt) ?? new Date(0).toISOString(),
        source: firstValueSource.source === "workspace" ? "workspace" : "system",
        summary: asString(firstValueSource.summary),
        revenueTrack:
          firstValueSource.revenueTrack === "service_business" ||
          firstValueSource.revenueTrack === "content_business" ||
          firstValueSource.revenueTrack === "software_business"
            ? firstValueSource.revenueTrack
            : null,
      }
    : null;

  const revenueEvents = Array.isArray(source.revenueEvents)
    ? source.revenueEvents
        .map((item) => normalizeRevenueEvent(item))
        .filter((item): item is RevenueEvent => Boolean(item))
    : [];
  const processedStripeEventIds = Array.isArray(source.processedStripeEventIds)
    ? source.processedStripeEventIds
        .filter((item): item is string => typeof item === "string")
        .slice(-200)
    : [];

  return {
    firstValueEvent,
    revenueEvents,
    processedStripeEventIds,
    payoutStatus: normalizePayoutStatus(source.payoutStatus),
    updatedAt: asString(source.updatedAt),
  };
}

export function withFirstValueEvent(input: {
  current: AutopilotRevenueMetadata;
  createdAt: string;
  summary: string | null;
  revenueTrack: RevenueTrack | null;
}): AutopilotRevenueMetadata {
  return {
    ...input.current,
    firstValueEvent: {
      createdAt: input.createdAt,
      source: "workspace" as const,
      summary: input.summary,
      revenueTrack: input.revenueTrack,
    },
    updatedAt: input.createdAt,
  };
}

export function withRevenueEvent(input: {
  current: AutopilotRevenueMetadata;
  event: RevenueEvent;
}): AutopilotRevenueMetadata {
  return {
    ...input.current,
    revenueEvents: [...input.current.revenueEvents, input.event],
    updatedAt: input.event.createdAt,
  };
}

export function withProcessedStripeEvent(input: {
  current: AutopilotRevenueMetadata;
  eventId: string;
  updatedAt: string;
}): AutopilotRevenueMetadata {
  if (!input.eventId.trim()) {
    return input.current;
  }

  const nextProcessed = Array.from(
    new Set([...input.current.processedStripeEventIds, input.eventId]),
  ).slice(-200);

  return {
    ...input.current,
    processedStripeEventIds: nextProcessed,
    updatedAt: input.updatedAt,
  };
}

export function milestoneFromRevenueEvent(
  kind: RevenueEvent["kind"] | "first_value_created",
): LaunchRevenueMilestone {
  switch (kind) {
    case "first_value_created":
      return "first_value_created";
    case "offer_live":
      return "first_offer_live";
    case "checkout_live":
      return "first_checkout_live";
    case "revenue_recorded":
      return "first_revenue_recorded";
    case "payment_failed":
      return "first_checkout_live";
  }
}

export function advanceMilestoneFromEvent(input: {
  current: LaunchRevenueMilestone | null;
  kind: RevenueEvent["kind"] | "first_value_created";
}) {
  return advanceRevenueMilestone(input.current, milestoneFromRevenueEvent(input.kind));
}

export function summarizeRevenueStatus(value: AutopilotRevenueMetadata) {
  const latestEvent = value.revenueEvents[value.revenueEvents.length - 1] ?? null;
  const billingHealth = latestEvent?.kind === "payment_failed" ? "attention" : "ok";

  let payoutStatusLabel = "Noch kein Umsatz";
  if (value.payoutStatus.status === "pending") {
    payoutStatusLabel = "Auszahlung offen";
  }
  if (value.payoutStatus.status === "paid") {
    payoutStatusLabel = "Ausgezahlt";
  }

  return {
    billingHealth,
    payoutStatusLabel,
    latestEvent,
  };
}
