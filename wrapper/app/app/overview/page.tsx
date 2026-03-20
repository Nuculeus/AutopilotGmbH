import { BridgeError, type PaperclipDashboardSummary, readPaperclipBridgeJson } from "@/lib/paperclip-bridge";
import { getCurrentUserState } from "@/lib/current-user";

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

async function loadSummary() {
  const { userId, autopilotState } = await getCurrentUserState();
  if (!userId) return null;

  try {
    return await readPaperclipBridgeJson<PaperclipDashboardSummary>({
      request: new Request("http://localhost/api/paperclip/dashboard-summary"),
      pathSegments: ["dashboard-summary"],
      userId,
      autopilotState,
    });
  } catch (error) {
    if (error instanceof BridgeError) {
      return null;
    }
    throw error;
  }
}

export default async function AppOverviewPage() {
  const summary = await loadSummary();

  return (
    <section className="app-surface-grid">
      <article className="app-surface-card app-surface-card-wide">
        <p className="app-surface-eyebrow">Übersicht</p>
        <h2 className="app-surface-title">Launch Control Center</h2>
        <p className="app-surface-copy">
          Die Wrapper-Shell zieht hier bereits live die ersten Paperclip-Daten
          durch die kontrollierte Bridge. Billing, Credits und DSGVO-Hinweise
          bleiben weiter nativ im Wrapper.
        </p>
      </article>
      <article className="app-surface-card">
        <p className="app-surface-eyebrow">Agents</p>
        <h2 className="app-surface-title">
          {summary ? `${summary.agents.active} aktiv / ${summary.agents.running} laufend` : "Bridge bereit"}
        </h2>
        <p className="app-surface-copy">
          {summary
            ? `${summary.agents.paused} pausiert, ${summary.agents.error} mit Fehlerstatus.`
            : "Sobald Daten vorliegen, erscheinen hier die ersten operativen KPI-Karten."}
        </p>
      </article>
      <article className="app-surface-card">
        <p className="app-surface-eyebrow">Budget</p>
        <h2 className="app-surface-title">
          {summary ? formatCurrency(summary.costs.monthSpendCents) : "Noch kein Verbrauch"}
        </h2>
        <p className="app-surface-copy">
          {summary
            ? `${formatCurrency(summary.costs.monthBudgetCents)} Monatsbudget · ${summary.costs.monthUtilizationPercent}% Auslastung`
            : "Die ersten Verbrauchs- und Budgetsignale hängen jetzt direkt an der Bridge."}
        </p>
      </article>
      <article className="app-surface-card">
        <p className="app-surface-eyebrow">Tasks</p>
        <h2 className="app-surface-title">
          {summary ? `${summary.tasks.open} offen / ${summary.tasks.inProgress} in Arbeit` : "Noch keine Aufgaben"}
        </h2>
        <p className="app-surface-copy">
          {summary
            ? `${summary.tasks.blocked} blockiert · ${summary.pendingApprovals} Freigaben ausstehend`
            : "Die operative Pipeline wird hier sichtbar, sobald die Company echte Arbeit annimmt."}
        </p>
      </article>
    </section>
  );
}
