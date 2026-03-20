import { ConnectionsManager } from "@/components/connections-manager";
import {
  BridgeError,
  type PaperclipCompanySecret,
  type PaperclipSecretProvider,
  readPaperclipBridgeJson,
} from "@/lib/paperclip-bridge";
import { getCurrentUserState } from "@/lib/current-user";

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

export default async function AppConnectionsPage() {
  const { providers, secrets, error } = await loadConnectionsState();

  return (
    <section className="space-y-6">
      <div className="app-focus-card">
        <p className="app-surface-eyebrow">Connections</p>
        <h2 className="app-surface-title">Bring your own keys</h2>
        <p className="app-surface-copy">
          Hier setzen wir die Kundenzugänge bewusst so an, dass teure
          Heavy-Use-Workflows nicht auf unsere Instanzkosten zurückfallen.
        </p>
        {error ? <p className="app-muted mt-4 text-sm">{error}</p> : null}
      </div>

      <ConnectionsManager initialSecrets={secrets} providers={providers} />
    </section>
  );
}
