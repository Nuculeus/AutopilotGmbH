import { BridgeError, type PaperclipDashboardSummary, readPaperclipBridgeJson } from "@/lib/paperclip-bridge";
import { getCurrentUserState } from "@/lib/current-user";
import { appStarterTemplates } from "@/lib/guided-launch";
import { buildServiceStarterTemplates } from "@/lib/service-engine";

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
  const { companyHqProfile } = await getCurrentUserState();
  const starterTemplates =
    companyHqProfile.revenueTrack === "service_business"
      ? buildServiceStarterTemplates(companyHqProfile)
      : appStarterTemplates;

  return (
    <section className="space-y-6">
      <article className="app-focus-card">
        <p className="app-surface-eyebrow">Apps</p>
        <h2 className="app-surface-title">Starte mit einem klaren Baustein</h2>
        <p className="app-surface-copy">
          Du musst keine große Plattform konfigurieren. Starte mit einem
          einfachen operativen Baustein und lass den Workspace den ersten Output
          erzeugen.
        </p>
      </article>

      <section className="guided-grid">
        {starterTemplates.map((item) => (
          <article key={item.id} className="guided-card">
            <p className="app-surface-eyebrow">Starter App</p>
            <h3 className="guided-title">{item.title}</h3>
            <p className="guided-prompt">{item.description}</p>
            <div className="guided-prompt-box">{item.kickoffPrompt}</div>
            <a className="workspace-launch-link" href="/app/chat">
              Im Workspace starten
            </a>
          </article>
        ))}
      </section>

      <section className="app-surface-grid">
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
    </section>
  );
}
