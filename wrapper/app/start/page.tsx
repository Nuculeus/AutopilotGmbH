import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react";
import { AuthControls } from "../../components/auth-controls";
import { formatPlanLabel } from "../../lib/credits";
import { getCurrentUserState } from "../../lib/current-user";
import { resolveLaunchEntryDecision } from "../../lib/launch-entry";
import { resolveLaunchFlowState } from "../../lib/launch-flow";
import { advanceRevenueMilestone } from "../../lib/revenue-track";
import { buildStartPageModel } from "../../lib/start-page";
import { buildStartReliabilityModel } from "../../lib/start-reliability";

const checklist = [
  "Aufbauprofil gespeichert und Firmenkern geklärt",
  "Startguthaben oder Plan aktiv",
  "Provisioning-Bridge erreichbar",
  "Workspace-Handoff vorbereitet",
];

export default async function StartPage() {
  const {
    userId,
    hasCompanyHqBriefing,
    hasBillingBypass,
    hasRunnableLlmConnection,
    hasVerifiedLlmReadiness,
    hasRequiredRevenueConnections,
    companyHqProfile,
    creditSummary,
    autopilotState,
    provisioningRun,
  } = await getCurrentUserState();
  const hasReadyLlmConnection =
    hasRunnableLlmConnection && hasVerifiedLlmReadiness;

  if (userId && !hasCompanyHqBriefing && !autopilotState.companyId && autopilotState.provisioningStatus === "not_started") {
    redirect("/onboarding");
  }

  const flow = resolveLaunchFlowState({
    availableCredits: creditSummary.availableCredits,
    plan: creditSummary.plan,
    hasBillingBypass,
    hasCompanyHqBriefing,
    companyId: autopilotState.companyId,
    provisioningStatus: autopilotState.provisioningStatus,
    canOpenWorkspace: autopilotState.canOpenWorkspace,
    hasRunnableLlmConnection: hasReadyLlmConnection,
    hasRequiredRevenueConnections,
    revenueMilestone: autopilotState.canOpenWorkspace
      ? advanceRevenueMilestone(
          companyHqProfile.nextMilestone,
          hasRequiredRevenueConnections && hasReadyLlmConnection ? "workspace_ready" : "model_ready",
        )
      : companyHqProfile.nextMilestone,
  });
  const launchEntry = resolveLaunchEntryDecision({
    userId,
    hasCompanyHqBriefing,
    hasRunnableLlmConnection: hasReadyLlmConnection,
    hasRequiredRevenueConnections,
    hasBillingBypass,
    availableCredits: creditSummary.availableCredits,
    plan: creditSummary.plan,
    companyId: autopilotState.companyId,
    provisioningStatus: autopilotState.provisioningStatus,
    canOpenWorkspace: autopilotState.canOpenWorkspace,
  });
  const startPageModel = buildStartPageModel({
    revenueTrack: companyHqProfile.revenueTrack,
    availableCredits: creditSummary.availableCredits,
    reversedCredits: creditSummary.reversedCredits,
  });
  const reliabilityModel = buildStartReliabilityModel({
    provisioningStatus: autopilotState.provisioningStatus,
    provisioningRun: provisioningRun
      ? {
          id: provisioningRun.id,
          status: provisioningRun.status,
          lastError: provisioningRun.lastError,
          retryEligible: provisioningRun.retryEligible,
        }
      : null,
  });

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-6 py-8 sm:px-10 lg:px-12">
      <div className="flex flex-col gap-4 border-b border-[var(--line)] pb-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link className="nav-link" href="/">
            <ArrowLeft className="h-4 w-4" />
            Zurück
          </Link>
          <AuthControls />
        </div>
        <p className="font-mono text-xs uppercase tracking-[0.28em] text-[var(--muted)]">
          Firma starten
        </p>
      </div>

      <section className="grid gap-8 py-10 lg:grid-cols-[1fr_0.9fr]">
        <article className="space-y-6">
          <div className="space-y-4">
            <h1 className="text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">
              Ersten Sprint absichern und Workspace vorbereiten
            </h1>
            <p className="max-w-2xl text-base leading-8 text-[var(--soft)]">
              Dein Aufbauprofil ist gespeichert. Jetzt sichern wir den ersten
              klar benannten Sprint, den Budgetrahmen und die eigentliche
              Provisionierung in Paperclip, damit dein Workspace ohne unnötige
              Fehlstarts betriebsbereit wird.
            </p>
          </div>

          <div className="panel-shell space-y-4">
            <div className="space-y-3">
              <p className="font-mono text-xs uppercase tracking-[0.28em] text-[var(--muted)]">
                Sprint-Katalog
              </p>
              <h2 className="text-2xl font-semibold tracking-[-0.03em]">
                {startPageModel.headline}
              </h2>
              <p className="text-sm leading-7 text-[var(--soft)]">
                {startPageModel.intro}
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {startPageModel.sprints.map((sprint) => (
                <div key={sprint.key} className="credit-stat h-full">
                  <span className="credit-label">{sprint.label}</span>
                  <strong className="credit-value">{sprint.estimatedCredits} Credits</strong>
                  <p className="mt-2 text-sm leading-7 text-[var(--soft)]">
                    {sprint.deliverable}
                  </p>
                  <p className="mt-3 text-sm leading-7 text-[var(--soft)]">
                    Erfolg: {sprint.successCondition}
                  </p>
                  <p className="mt-3 text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                    Maximal automatisch: {sprint.maxCredits} Credits
                  </p>
                </div>
              ))}
            </div>

            <p className="text-sm leading-7 text-[var(--soft)]">
              {startPageModel.safetyNotice}
            </p>
          </div>

          <div className="space-y-4">
            {checklist.map((item) => (
              <div key={item} className="milestone-row">
                <span className="icon-chip">
                  <CheckCircle2 className="h-4 w-4" />
                </span>
                <p className="text-sm leading-7 text-[var(--soft)]">{item}</p>
              </div>
            ))}
          </div>

          <div className="panel-shell space-y-4">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.28em] text-[var(--muted)]">
                Reliability
              </p>
              <h2 className="mt-3 text-2xl font-semibold tracking-[-0.03em]">
                Launch-Laeufe bleiben nachvollziehbar
              </h2>
            </div>
            <div className="credits-stack">
              <div className="credit-stat">
                <span className="credit-label">Aktueller Lauf</span>
                <strong className="credit-value">{reliabilityModel.runLabel}</strong>
              </div>
              <div className="credit-stat">
                <span className="credit-label">Status</span>
                <strong className="credit-value">{reliabilityModel.stateLabel}</strong>
              </div>
              <div className="credit-stat">
                <span className="credit-label">Belastungsschutz</span>
                <strong className="credit-value">{reliabilityModel.chargeProtection}</strong>
              </div>
              {reliabilityModel.failureReason ? (
                <div className="credit-stat">
                  <span className="credit-label">Fehlergrund</span>
                  <strong className="credit-value">{reliabilityModel.failureReason}</strong>
                </div>
              ) : null}
            </div>
            <p className="text-sm leading-7 text-[var(--soft)]">
              {reliabilityModel.nextStepCopy}
            </p>
          </div>
        </article>

        <aside className="panel-shell">
          <div className="panel-header">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.28em] text-[var(--muted)]">
                Nächster Schritt
              </p>
              <h2 className="mt-3 text-2xl font-semibold tracking-[-0.03em]">
                Provisioning anschließen
              </h2>
            </div>
          </div>

          <p className="text-sm leading-7 text-[var(--soft)]">
            {flow.description}
          </p>

          <div className="credits-stack">
            <div className="credit-stat">
              <span className="credit-label">Verfuegbares Guthaben</span>
              <strong className="credit-value">
                {startPageModel.budgetSummary}
              </strong>
            </div>
            <div className="credit-stat">
              <span className="credit-label">Plan</span>
              <strong className="credit-value">
                {formatPlanLabel(creditSummary.plan)}
              </strong>
            </div>
            <div className="credit-stat">
              <span className="credit-label">Gutgeschrieben</span>
              <strong className="credit-value">
                {creditSummary.grantedCredits} Credits
              </strong>
            </div>
            <div className="credit-stat">
              <span className="credit-label">Belastet</span>
              <strong className="credit-value">
                {creditSummary.debitedCredits} Credits
              </strong>
            </div>
            <div className="credit-stat">
              <span className="credit-label">Retry-Schutz</span>
              <strong className="credit-value">
                {startPageModel.safetyNotice}
              </strong>
            </div>
            <div className="credit-stat">
              <span className="credit-label">Provisioning</span>
              <strong className="credit-value">{flow.title}</strong>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-3">
            {creditSummary.bonusEligible ? (
              <form action="/api/credits/claim" method="POST">
                <button className="secondary-cta w-full" type="submit">
                  100 Launch-Guthaben claimen
                </button>
              </form>
            ) : null}
            <form action={flow.primaryAction.href} method={flow.primaryAction.method ?? "GET"}>
              <button className="primary-cta w-full" type="submit">
                {flow.primaryAction.label}
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>
            {flow.stage !== "needs_access" ? (
              <form action="/api/stripe/checkout" method="POST">
                <button className="secondary-cta w-full" type="submit">
                  Starter Checkout trotzdem starten
                </button>
              </form>
            ) : null}
            <Link className="secondary-cta" href="/">
              Zur Landingpage
            </Link>
            <Link className="secondary-cta" href="/dashboard">
              Dashboard ansehen
            </Link>
            <Link className="secondary-cta" href={launchEntry.href}>
              Zentralen Einstieg öffnen
            </Link>
          </div>
        </aside>
      </section>
    </main>
  );
}
