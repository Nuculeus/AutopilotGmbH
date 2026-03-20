import { BridgeError, type PaperclipDashboardSummary, readPaperclipBridgeJson } from "@/lib/paperclip-bridge";
import { getCurrentUserState } from "@/lib/current-user";

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

export default async function AppAppsPage() {
  const summary = await loadSummary();

  return (
    <section className="app-surface-grid">
      <article className="app-focus-card">
        <p className="app-surface-eyebrow">Apps</p>
        <h2 className="app-surface-title">Deployments mit Guardrails</h2>
        <p className="app-surface-copy">
          Apps, Seiten und Agenten-Outputs bekommen für den Launch denselben
          kontrollierten Brückenzugang wie Dashboard und Connections.
        </p>
      </article>
      <article className="app-surface-card">
        <p className="app-surface-eyebrow">Tasks</p>
        <h3 className="app-surface-title">
          {summary ? `${summary.tasks.inProgress} Rollouts in Arbeit` : "Noch keine Rollouts"}
        </h3>
        <p className="app-surface-copy">
          {summary
            ? `${summary.tasks.done} bereits abgeschlossen`
            : "Sobald die ersten produktiven Outputs laufen, erscheinen sie hier im Wrapper-Rahmen."}
        </p>
      </article>
      <article className="app-surface-card">
        <p className="app-surface-eyebrow">Poweruser-Schutz</p>
        <h3 className="app-surface-title">BYO APIs bevorzugt</h3>
        <p className="app-surface-copy">
          Deployments, Video-Flows und ähnliche Heavy-Use-Aktionen bleiben im
          Launch bewusst an kundeneigene Tool-Zugänge gekoppelt.
        </p>
      </article>
    </section>
  );
}
