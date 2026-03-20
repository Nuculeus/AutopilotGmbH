import Link from "next/link";
import { ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react";
import { AuthControls } from "../../components/auth-controls";
import { formatPlanLabel } from "../../lib/credits";
import { getCurrentUserState } from "../../lib/current-user";
import { resolveLaunchEntryDecision } from "../../lib/launch-entry";
import { resolveLaunchFlowState } from "../../lib/launch-flow";

const checklist = [
  "Clerk Account vorhanden oder Sign-up abgeschlossen",
  "Stripe Plan ausgewählt und Checkout bereit",
  "Company-Slug und Name validiert",
  "Paperclip Provisioning-Bridge erreichbar",
];

export default async function StartPage() {
  const { userId, creditSummary, autopilotState } = await getCurrentUserState();
  const flow = resolveLaunchFlowState({
    availableCredits: creditSummary.availableCredits,
    plan: creditSummary.plan,
    companyId: autopilotState.companyId,
    provisioningStatus: autopilotState.provisioningStatus,
    canOpenWorkspace: autopilotState.canOpenWorkspace,
  });
  const launchEntry = resolveLaunchEntryDecision({
    userId,
    availableCredits: creditSummary.availableCredits,
    plan: creditSummary.plan,
    companyId: autopilotState.companyId,
    provisioningStatus: autopilotState.provisioningStatus,
    canOpenWorkspace: autopilotState.canOpenWorkspace,
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
              Der Startfluss für neue Companies
            </h1>
            <p className="max-w-2xl text-base leading-8 text-[var(--soft)]">
              Diese Route wird der Einstiegspunkt für Clerk, Stripe und die
              eigentliche Provisionierung in Paperclip. Im Moment markieren wir
              hier bewusst den Handoff, den wir als Nächstes technisch
              verdrahten.
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
              <span className="credit-label">Verfuegbar</span>
              <strong className="credit-value">
                {creditSummary.availableCredits} Credits
              </strong>
            </div>
            <div className="credit-stat">
              <span className="credit-label">Plan</span>
              <strong className="credit-value">
                {formatPlanLabel(creditSummary.plan)}
              </strong>
            </div>
            <div className="credit-stat">
              <span className="credit-label">Launch Bonus</span>
              <strong className="credit-value">
                {creditSummary.launchBonusClaimed ? "bereits aktiviert" : "100 Credits offen"}
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
                  100 Launch Credits claimen
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
