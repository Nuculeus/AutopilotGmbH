type LaunchStatusPanelProps = {
  companyLabel: string;
  planLabel: string;
  creditsLabel: string;
  provisioningLabel: string;
  checklist: string[];
};

export function LaunchStatusPanel({
  companyLabel,
  planLabel,
  creditsLabel,
  provisioningLabel,
  checklist,
}: LaunchStatusPanelProps) {
  return (
    <aside className="app-rail">
      <div className="app-rail-section">
        <p className="app-rail-eyebrow">Status</p>
        <div className="app-status-grid">
          <div className="app-status-card">
            <span className="app-status-label">Company</span>
            <strong className="app-status-value">{companyLabel}</strong>
          </div>
          <div className="app-status-card">
            <span className="app-status-label">Plan</span>
            <strong className="app-status-value">{planLabel}</strong>
          </div>
          <div className="app-status-card">
            <span className="app-status-label">Credits</span>
            <strong className="app-status-value">{creditsLabel}</strong>
          </div>
          <div className="app-status-card">
            <span className="app-status-label">Provisioning</span>
            <strong className="app-status-value">{provisioningLabel}</strong>
          </div>
        </div>
      </div>

      <div className="app-rail-section">
        <p className="app-rail-eyebrow">Getting Started</p>
        <div className="app-checklist">
          {checklist.map((item, index) => (
            <div key={item} className="app-checklist-item">
              <span className="app-checklist-index">{index + 1}</span>
              <div>
                <strong className="app-checklist-title">{item}</strong>
                <p className="app-checklist-copy">
                  Dieser Schritt wird in der Wrapper-Shell sichtbar und spaeter
                  mit den echten Workspace-Aktionen verknüpft.
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}
