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

export default async function AppChatPage() {
  const summary = await loadSummary();

  return (
    <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
      <section className="app-focus-card">
        <p className="app-surface-eyebrow">Chat Bridge</p>
        <h2 className="app-surface-title">Kontrollierter Workspace-Zugang steht</h2>
        <p className="app-surface-copy">
          Der Launch-Chat läuft bewusst noch nicht als offene Vollfläche. Aber
          die Bridge hängt jetzt bereits an derselben Company-Zuordnung und dem
          stabilen `clerk:&lt;userId&gt;`-Principal wie das Provisioning.
        </p>
      </section>

      <section className="app-surface-card">
        <p className="app-surface-eyebrow">Live Signale</p>
        <h3 className="app-surface-title">
          {summary ? `${summary.tasks.open} offene Aufgaben` : "Bridge waermt hoch"}
        </h3>
        <p className="app-surface-copy">
          {summary
            ? `${summary.agents.running} laufende Agenten · ${summary.pendingApprovals} Freigaben`
            : "Sobald operative Daten ankommen, landet hier die erste echte Chat-/Task-Zusammenfassung."}
        </p>
      </section>
    </div>
  );
}
