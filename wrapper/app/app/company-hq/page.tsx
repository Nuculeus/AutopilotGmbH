import { BridgeError, type PaperclipDashboardSummary, readPaperclipBridgeJson } from "@/lib/paperclip-bridge";
import { getCurrentUserState } from "@/lib/current-user";
import { companyHqSetupSections } from "@/lib/guided-launch";

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

async function loadState() {
  const state = await getCurrentUserState();
  if (!state.userId) {
    return { autopilotState: state.autopilotState, summary: null };
  }

  try {
    const summary = await readPaperclipBridgeJson<PaperclipDashboardSummary>({
      request: new Request("http://localhost/api/paperclip/dashboard-summary"),
      pathSegments: ["dashboard-summary"],
      userId: state.userId,
      autopilotState: state.autopilotState,
    });
    return { autopilotState: state.autopilotState, summary };
  } catch (error) {
    if (error instanceof BridgeError) {
      return { autopilotState: state.autopilotState, summary: null };
    }
    throw error;
  }
}

export default async function AppCompanyHqPage() {
  const { autopilotState, summary } = await loadState();

  return (
    <section className="space-y-6">
      <article className="app-focus-card">
        <p className="app-surface-eyebrow">Company HQ</p>
        <h2 className="app-surface-title">
          {autopilotState.companyName ?? "Noch keine Company aktiv"}
        </h2>
        <p className="app-surface-copy">
          Beschreibe deine Firma einmal klar, damit Operatoren, Automationen und
          spätere Apps mit einem konsistenten Verständnis arbeiten.
        </p>
        <div className="guided-action-row">
          <a className="app-primary-cta" href="/app/chat">
            Im Workspace ausarbeiten
          </a>
          <a className="workspace-launch-link" href="/app/connections">
            Danach Verbindungen anschließen
          </a>
        </div>
      </article>

      <section className="guided-grid">
        {companyHqSetupSections.map((section) => (
          <article key={section.title} className="guided-card">
            <p className="app-surface-eyebrow">Briefing</p>
            <h3 className="guided-title">{section.title}</h3>
            <p className="guided-prompt">{section.prompt}</p>
            <p className="guided-helper">{section.helper}</p>
          </article>
        ))}
      </section>

      <section className="app-surface-grid">
      <article className="app-surface-card">
        <p className="app-surface-eyebrow">Monatsbudget</p>
        <h3 className="app-surface-title">
          {summary ? formatCurrency(summary.costs.monthBudgetCents) : "Noch nicht gesetzt"}
        </h3>
        <p className="app-surface-copy">
          {summary
            ? `${formatCurrency(summary.costs.monthSpendCents)} verbraucht`
            : "Hier hängen wir als Nächstes die harte Launch-Budgetpolitik sichtbar an."}
        </p>
      </article>
      <article className="app-surface-card">
        <p className="app-surface-eyebrow">Governance</p>
        <h3 className="app-surface-title">
          {summary ? `${summary.budgets.activeIncidents} Budget-Incidents` : "Keine Incidents"}
        </h3>
        <p className="app-surface-copy">
          {summary
            ? `${summary.budgets.pausedAgents} pausierte Agenten · ${summary.budgets.pendingApprovals} Freigaben`
          : "Poweruser- und Compliance-Signale landen hier zentral im Wrapper."}
        </p>
      </article>
      </section>
    </section>
  );
}
