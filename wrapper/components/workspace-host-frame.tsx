type WorkspaceHostFrameProps = {
  title?: string;
};

export function WorkspaceHostFrame({
  title = "AutopilotGmbH Workspace",
}: WorkspaceHostFrameProps) {
  return (
    <section className="workspace-host-shell">
      <iframe
        className="workspace-host-frame"
        src="/api/paperclip/workspace"
        title={title}
      />
    </section>
  );
}
