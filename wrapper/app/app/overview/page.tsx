export default function AppOverviewPage() {
  return (
    <section className="app-surface-grid">
      <article className="app-surface-card app-surface-card-wide">
        <p className="app-surface-eyebrow">Übersicht</p>
        <h2 className="app-surface-title">Launch Control Center</h2>
        <p className="app-surface-copy">
          Hier landen als Nächstes die nativen KPI-Karten, Provisioning-Metriken
          und die Wrapper-eigenen Trial-, Billing- und Compliance-Signale.
        </p>
      </article>
      <article className="app-surface-card">
        <p className="app-surface-eyebrow">Credits</p>
        <h2 className="app-surface-title">Launch Credits aktiv</h2>
        <p className="app-surface-copy">
          Poweruser-Schutz, Budget-Deckel und spätere Queue-Signale hängen wir
          hier als Nächstes sichtbar dran.
        </p>
      </article>
      <article className="app-surface-card">
        <p className="app-surface-eyebrow">Bridge</p>
        <h2 className="app-surface-title">Paperclip bereit</h2>
        <p className="app-surface-copy">
          Die sichere interne `bootstrap-company`-Achse steht bereits. Als
          Nächstes hängen wir die ersten produktiven Workspace-Flächen an.
        </p>
      </article>
    </section>
  );
}
