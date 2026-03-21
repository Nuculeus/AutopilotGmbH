import Link from "next/link";

type WorkspaceHostFrameProps = {
  title?: string;
  handoff?: {
    headline: string;
    summary: string;
    highlights: Array<{
      label: string;
      value: string;
    }>;
    actions: Array<{
      label: string;
      href: string;
    }>;
  } | null;
};

export function WorkspaceHostFrame({
  title = "AutopilotGmbH Workspace",
  handoff,
}: WorkspaceHostFrameProps) {
  const launchHandoff = handoff ?? {
    headline: "Firma aktiv. Workspace verbunden.",
    summary: "Als Nächstes Unternehmenswissen festhalten oder Verbindungen anschließen.",
    highlights: [],
    actions: [
      { label: "Company HQ", href: "/app/company-hq" },
      { label: "Verbindungen", href: "/app/connections" },
    ],
  };

  return (
    <section className="workspace-host-shell">
      <div className="workspace-launch-strip">
        <div className="workspace-launch-top">
          <div className="workspace-launch-copy">
            <strong>{launchHandoff.headline}</strong>
            <span>{launchHandoff.summary}</span>
          </div>
          <div className="workspace-launch-actions">
            {launchHandoff.actions.map((action) => (
              <Link key={action.href} className="workspace-launch-link" href={action.href}>
                {action.label}
              </Link>
            ))}
          </div>
        </div>
        {launchHandoff.highlights.length > 0 ? (
          <div className="workspace-launch-highlights">
            {launchHandoff.highlights.map((highlight) => (
              <div key={highlight.label} className="workspace-launch-highlight">
                <span className="workspace-launch-highlight-label">{highlight.label}</span>
                <strong className="workspace-launch-highlight-value">{highlight.value}</strong>
              </div>
            ))}
          </div>
        ) : null}
      </div>
      <iframe
        className="workspace-host-frame"
        src="/api/paperclip/workspace"
        title={title}
      />
    </section>
  );
}
