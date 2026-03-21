import { ConnectionsManager } from "@/components/connections-manager";
import {
  BridgeError,
  type PaperclipCompanySecret,
  type PaperclipSecretProvider,
  readPaperclipBridgeJson,
} from "@/lib/paperclip-bridge";
import { getCurrentUserState } from "@/lib/current-user";
import { priorityConnectionTemplates } from "@/lib/guided-launch";

async function loadConnectionsState() {
  const { userId, autopilotState } = await getCurrentUserState();

  if (!userId) {
    return {
      providers: [] as PaperclipSecretProvider[],
      secrets: [] as PaperclipCompanySecret[],
      error: null as string | null,
    };
  }

  try {
    const [providers, secrets] = await Promise.all([
      readPaperclipBridgeJson<PaperclipSecretProvider[]>({
        request: new Request("http://localhost/api/paperclip/secret-providers"),
        pathSegments: ["secret-providers"],
        userId,
        autopilotState,
      }),
      readPaperclipBridgeJson<PaperclipCompanySecret[]>({
        request: new Request("http://localhost/api/paperclip/secrets"),
        pathSegments: ["secrets"],
        userId,
        autopilotState,
      }),
    ]);

    return { providers, secrets, error: null };
  } catch (error) {
    if (error instanceof BridgeError) {
      return {
        providers: [] as PaperclipSecretProvider[],
        secrets: [] as PaperclipCompanySecret[],
        error: error.message,
      };
    }
    throw error;
  }
}

type AppConnectionsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AppConnectionsPage({
  searchParams,
}: AppConnectionsPageProps) {
  const { providers, secrets, error } = await loadConnectionsState();
  const params = searchParams ? await searchParams : {};
  const preset =
    typeof params.preset === "string" ? params.preset : null;

  return (
    <section className="space-y-6">
      <div className="app-focus-card">
        <p className="app-surface-eyebrow">Connections</p>
        <h2 className="app-surface-title">Plug-and-play zuerst</h2>
        <p className="app-surface-copy">
          Verbinde zuerst genau die Zugänge, die deine Firma sofort
          handlungsfähig machen. Der tiefere Katalog bleibt darunter erhalten.
        </p>
        {error ? <p className="app-muted mt-4 text-sm">{error}</p> : null}
      </div>

      <section className="guided-grid guided-grid-three">
        {priorityConnectionTemplates.map((item) => (
          <article key={item.id} className="guided-card">
            <p className="app-surface-eyebrow">Starter</p>
            <h3 className="guided-title">{item.label}</h3>
            <p className="guided-prompt">{item.description}</p>
            <a className="workspace-launch-link" href={`/app/connections?preset=${item.id}#connect-form`}>
              Jetzt vorbereiten
            </a>
          </article>
        ))}
      </section>

      <ConnectionsManager
        initialPresetId={preset}
        initialSecrets={secrets}
        providers={providers}
      />
    </section>
  );
}
