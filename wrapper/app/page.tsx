import Link from "next/link";
import {
  ArrowRight,
  BadgeEuro,
  Building2,
  FileSpreadsheet,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { AuthControls } from "../components/auth-controls";

const pillars = [
  {
    title: "Firma starten statt Tools stapeln",
    description:
      "AutopilotGmbH provisioniert deine Company, bindet Paperclip an und bringt dich direkt in ein arbeitsfähiges Dashboard.",
    icon: Building2,
  },
  {
    title: "DSGVO zuerst, nicht nachträglich",
    description:
      "Deutsche Prompting-Regeln, Consent-Grenzen und Löschlogik sitzen von Anfang an in der Betriebslogik.",
    icon: ShieldCheck,
  },
  {
    title: "Umsatz, Rechnungen, DATEV im Blick",
    description:
      "Die Produktoberfläche ist für Operatoren gebaut, nicht für Bastler: klare Kennzahlen, klare Zustände, klare Übergaben.",
    icon: FileSpreadsheet,
  },
];

const milestones = [
  "Landingpage und Billing im Wrapper",
  "Company-Provisioning Richtung Paperclip",
  "Runtime-Injection für deutsche Skills",
  "DATEV- und Report-Outputs im Dashboard",
];

export default function Home() {
  return (
    <main className="relative overflow-hidden">
      <div className="hero-glow hero-glow-left" />
      <div className="hero-glow hero-glow-right" />

      <section className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-6 pb-16 pt-8 sm:px-10 lg:px-12">
        <header className="flex items-center justify-between border-b border-[var(--line)] pb-5">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.32em] text-[var(--muted)]">
              AutopilotGmbH
            </p>
            <p className="mt-2 text-sm text-[var(--soft)]">
              Zero-human company operations for Germany and the EU
            </p>
          </div>

          <nav className="hidden items-center gap-3 md:flex">
            <Link className="nav-link" href="/dashboard">
              Dashboard
            </Link>
            <Link className="nav-link" href="/start">
              Firma starten
            </Link>
            <AuthControls />
          </nav>
        </header>

        <div className="grid flex-1 gap-12 py-14 lg:grid-cols-[1.25fr_0.75fr] lg:gap-14">
          <section className="space-y-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-white/70 px-3 py-2 backdrop-blur">
              <Sparkles className="h-4 w-4 text-[var(--accent)]" />
              <span className="font-mono text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
                Deutsche Agenten, echte Betriebsoberfläche
              </span>
            </div>

            <div className="space-y-6">
              <h1 className="max-w-4xl text-5xl font-semibold leading-[1.02] tracking-[-0.04em] text-balance sm:text-6xl lg:text-7xl">
                Starte die Firma nachts. Um 8 Uhr arbeitet das Dashboard schon.
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-[var(--soft)] sm:text-xl">
                Wir bauen die deutsche SaaS-Schicht um Paperclip: Login,
                Billing, Company-Provisioning und ein Dashboard, das Umsatz,
                Rechnungen und steuerbare Prozesse sichtbar macht.
              </p>
            </div>

            <div className="flex flex-col gap-4 sm:flex-row">
              <Link className="primary-cta" href="/start">
                Firma starten
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link className="secondary-cta" href="/dashboard">
                Preview Dashboard
              </Link>
            </div>

            <div className="grid gap-4 pt-4 md:grid-cols-3">
              {pillars.map(({ title, description, icon: Icon }) => (
                <article key={title} className="surface-card space-y-4">
                  <div className="icon-chip">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-lg font-semibold tracking-[-0.02em]">
                      {title}
                    </h2>
                    <p className="text-sm leading-7 text-[var(--soft)]">
                      {description}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <aside className="panel-shell">
            <div className="panel-header">
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.28em] text-[var(--muted)]">
                  Mitternachts-Sprint
                </p>
                <h2 className="mt-3 text-2xl font-semibold tracking-[-0.03em]">
                  Der operative Kern
                </h2>
              </div>
              <div className="status-pill">
                <BadgeEuro className="h-4 w-4" />
                Umsatzbereit
              </div>
            </div>

            <div className="space-y-4">
              {milestones.map((milestone, index) => (
                <div key={milestone} className="milestone-row">
                  <span className="milestone-index">0{index + 1}</span>
                  <p className="text-sm leading-7 text-[var(--soft)]">
                    {milestone}
                  </p>
                </div>
              ))}
            </div>

            <div className="metrics-grid">
              <div className="metric-block">
                <span className="metric-label">Company Scope</span>
                <strong className="metric-value">isoliert</strong>
              </div>
              <div className="metric-block">
                <span className="metric-label">Hosting</span>
                <strong className="metric-value">EU only</strong>
              </div>
              <div className="metric-block">
                <span className="metric-label">Prompt Layer</span>
                <strong className="metric-value">DE + DSGVO</strong>
              </div>
              <div className="metric-block">
                <span className="metric-label">Go-live Ziel</span>
                <strong className="metric-value">08:00</strong>
              </div>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}
