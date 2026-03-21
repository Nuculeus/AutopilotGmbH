import Link from "next/link";
import { Activity, ArrowRight, BadgeEuro, FileBarChart2, Shield } from "lucide-react";
import { AuthControls } from "../../components/auth-controls";
import { formatPlanLabel } from "../../lib/credits";
import { getCurrentUserState } from "../../lib/current-user";
import { resolveLaunchEntryDecision } from "../../lib/launch-entry";
import { resolveLaunchFlowState } from "../../lib/launch-flow";

export default async function DashboardPage() {
  const { userId, hasCompanyHqBriefing, hasLlmConnection, creditSummary, autopilotState } = await getCurrentUserState();
  const flow = resolveLaunchFlowState({
    availableCredits: creditSummary.availableCredits,
    plan: creditSummary.plan,
    companyId: autopilotState.companyId,
    provisioningStatus: autopilotState.provisioningStatus,
    canOpenWorkspace: autopilotState.canOpenWorkspace,
  });
  const launchEntry = resolveLaunchEntryDecision({
    userId,
    hasCompanyHqBriefing,
    hasLlmConnection,
    availableCredits: creditSummary.availableCredits,
    plan: creditSummary.plan,
    companyId: autopilotState.companyId,
    provisioningStatus: autopilotState.provisioningStatus,
    canOpenWorkspace: autopilotState.canOpenWorkspace,
  });
  const cards = [
    {
      label: "Verfuegbare Credits",
      value: String(creditSummary.availableCredits),
      detail: `${creditSummary.freeTrialCredits} Trial + ${creditSummary.launchBonusCredits} Launch + ${creditSummary.monthlyPlanCredits} Plan`,
      icon: BadgeEuro,
    },
    {
      label: "Company Status",
      value: autopilotState.companyName ?? "noch keine Company",
      detail: `${autopilotState.provisioningStatus} / ${autopilotState.workspaceStatus}`,
      icon: Activity,
    },
    {
      label: "Aktiver Plan",
      value: formatPlanLabel(creditSummary.plan),
      detail: "Steuert Monatscredits und Feature-Grenzen",
      icon: Activity,
    },
    {
      label: "Launch Bonus",
      value: creditSummary.launchBonusClaimed ? "aktiv" : "offen",
      detail: creditSummary.launchBonusExpiresAt
        ? `gueltig bis ${new Date(creditSummary.launchBonusExpiresAt).toLocaleDateString("de-DE")}`
        : "100 Bonuscredits fuer den Launch-Claim",
      icon: Shield,
    },
    {
      label: "Verbrauchte Credits",
      value: String(creditSummary.consumedCredits),
      detail: "Wird spaeter pro Workflow und Agentenlauf belastet",
      icon: FileBarChart2,
    },
  ];

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-6 py-8 sm:px-10 lg:px-12">
      <div className="flex flex-col gap-4 border-b border-[var(--line)] pb-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="font-mono text-xs uppercase tracking-[0.28em] text-[var(--muted)]">
            Dashboard Preview
          </p>
          <AuthControls />
        </div>

        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="mt-3 text-4xl font-semibold tracking-[-0.04em]">
            Operative Lage deiner Company
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-[var(--soft)]">
            Das ist die Schicht zwischen Billing, Company-Provisioning und dem
            eigentlichen Paperclip-Betrieb. Hier landen Status, KPIs und
            steuerbare Folgeaktionen.
          </p>
        </div>

        <Link className="primary-cta self-start md:self-auto" href={launchEntry.href}>
          {launchEntry.label}
          <ArrowRight className="h-4 w-4" />
        </Link>
        </div>
      </div>

      <section className="grid gap-4 py-10 md:grid-cols-2 xl:grid-cols-4">
        {cards.map(({ label, value, detail, icon: Icon }) => (
          <article key={label} className="surface-card">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-[var(--muted)]">{label}</p>
                <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em]">
                  {value}
                </h2>
                <p className="mt-2 text-sm leading-6 text-[var(--soft)]">
                  {detail}
                </p>
              </div>
              <div className="icon-chip">
                <Icon className="h-5 w-5" />
              </div>
            </div>
          </article>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <article className="surface-card space-y-5">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
              Pipeline
            </p>
            <h2 className="mt-3 text-2xl font-semibold tracking-[-0.03em]">
              Nächste Automationsschritte
            </h2>
          </div>

          <div className="space-y-4">
            <div className="milestone-row">
              <span className="milestone-index">01</span>
              <p className="text-sm leading-7 text-[var(--soft)]">
                Launch-Credits claimen oder Starter-Checkout abschliessen.
              </p>
            </div>
            <div className="milestone-row">
              <span className="milestone-index">02</span>
              <p className="text-sm leading-7 text-[var(--soft)]">
                Company in Paperclip provisionieren und Tenant-Mapping speichern.
              </p>
            </div>
            <div className="milestone-row">
              <span className="milestone-index">03</span>
              <p className="text-sm leading-7 text-[var(--soft)]">
                Deutsche Skills und DSGVO-Regeln zur Laufzeit injizieren.
              </p>
            </div>
          </div>
        </article>

        <article className="panel-shell">
          <div className="panel-header">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.28em] text-[var(--muted)]">
                Handoff
              </p>
              <h2 className="mt-3 text-2xl font-semibold tracking-[-0.03em]">
                Paperclip Übergabe
              </h2>
            </div>
          </div>

          <p className="text-sm leading-7 text-[var(--soft)]">
            {flow.description}
          </p>

          <Link className="secondary-cta mt-6 inline-flex" href="/">
            Zurück zur Landingpage
          </Link>
        </article>
      </section>
    </main>
  );
}
