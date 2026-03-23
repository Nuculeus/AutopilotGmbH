import type { CreditLedgerRow } from "@/lib/db/types";
import type { CompanyHqProfile } from "@/lib/company-hq";
import type { ControlPlaneSnapshot } from "@/lib/control-plane-store";
import type { AutopilotRevenueMetadata } from "@/lib/revenue-events";

export function resolveControlPlaneStateSources(input: {
  controlPlaneSnapshot: ControlPlaneSnapshot | null;
  legacyCompanyHqProfile: CompanyHqProfile;
  legacyRevenue: AutopilotRevenueMetadata;
}) {
  if (input.controlPlaneSnapshot) {
    return {
      source: "control_plane" as const,
      companyHqProfile: input.controlPlaneSnapshot.profile,
      revenue: input.controlPlaneSnapshot.revenue,
      creditLedgerEntries: input.controlPlaneSnapshot.creditLedgerEntries,
    };
  }

  return {
    source: "legacy" as const,
    companyHqProfile: input.legacyCompanyHqProfile,
    revenue: input.legacyRevenue,
    creditLedgerEntries: [] as CreditLedgerRow[],
  };
}
