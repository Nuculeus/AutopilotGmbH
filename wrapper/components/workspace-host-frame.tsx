import Link from "next/link";

type WorkspaceHostFrameProps = {
  title?: string;
};

export function WorkspaceHostFrame({
  title = "AutopilotGmbH Workspace",
}: WorkspaceHostFrameProps) {
  return (
    <section className="workspace-host-shell">
      <div className="workspace-launch-strip">
        <div className="workspace-launch-copy">
          <strong>Firma aktiv. Workspace verbunden.</strong>
          <span>Als Nächstes Unternehmenswissen festhalten oder Verbindungen anschließen.</span>
        </div>
        <div className="workspace-launch-actions">
          <Link className="workspace-launch-link" href="/app/company-hq">
            Company HQ
          </Link>
          <Link className="workspace-launch-link" href="/app/connections">
            Verbindungen
          </Link>
        </div>
      </div>
      <iframe
        className="workspace-host-frame"
        src="/api/paperclip/workspace"
        title={title}
      />
    </section>
  );
}
