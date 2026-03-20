import { BridgeError, type PaperclipDashboardSummary, readPaperclipBridgeJson } from "@/lib/paperclip-bridge";
import { getCurrentUserState } from "@/lib/current-user";

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
    <section className="app-surface-grid">
      <article className="app-focus-card">
        <p className="app-surface-eyebrow">Company HQ</p>
        <h2 className="app-surface-title">
          {autopilotState.companyName ?? "Noch keine Company aktiv"}
        </h2>
        <p className="app-surface-copy">
          Die Wrapper-Shell bleibt deutsch und kundennah, während Paperclip im
          Hintergrund die operativen Zustände und Budgets liefert.
        </p>
      </article>
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
  );
}
