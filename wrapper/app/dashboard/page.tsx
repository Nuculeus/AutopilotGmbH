import Link from "next/link";
import { Activity, ArrowRight, BadgeEuro, FileBarChart2, Shield } from "lucide-react";

const cards = [
  {
    label: "Monatlicher Umsatz",
    value: "12.480 EUR",
    detail: "aus drei aktiven Companies",
    icon: BadgeEuro,
  },
  {
    label: "Agentenläufe",
    value: "48",
    detail: "seit Mitternacht ausgeführt",
    icon: Activity,
  },
  {
    label: "Compliance",
    value: "gruen",
    detail: "Consent und Logs im Rahmen",
    icon: Shield,
  },
  {
    label: "DATEV Export",
    value: "bereit",
    detail: "letzte Aktualisierung 07:42",
    icon: FileBarChart2,
  },
];

export default function DashboardPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-6 py-8 sm:px-10 lg:px-12">
      <div className="flex flex-col gap-4 border-b border-[var(--line)] pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.28em] text-[var(--muted)]">
            Dashboard Preview
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-[-0.04em]">
            Operative Lage deiner Company
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-[var(--soft)]">
            Das ist die Schicht zwischen Billing, Company-Provisioning und dem
            eigentlichen Paperclip-Betrieb. Hier landen Status, KPIs und
            steuerbare Folgeaktionen.
          </p>
        </div>

        <Link className="primary-cta self-start md:self-auto" href="/start">
          Neue Firma anlegen
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <section className="grid gap-4 py-10 md:grid-cols-2 xl:grid-cols-4">
        {cards.map(({ label, value, detail, icon: Icon }) => (
          <article key={label} className="surface-card">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-[var(--muted)]">{label}</p>
                <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em]">
                  {value}
                </h2>
                <p className="mt-2 text-sm leading-6 text-[var(--soft)]">
                  {detail}
                </p>
              </div>
              <div className="icon-chip">
                <Icon className="h-5 w-5" />
              </div>
            </div>
          </article>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <article className="surface-card space-y-5">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
              Pipeline
            </p>
            <h2 className="mt-3 text-2xl font-semibold tracking-[-0.03em]">
              Nächste Automationsschritte
            </h2>
          </div>

          <div className="space-y-4">
            <div className="milestone-row">
              <span className="milestone-index">01</span>
              <p className="text-sm leading-7 text-[var(--soft)]">
                Checkout bestätigen und Billing-Status auf aktiv setzen.
              </p>
            </div>
            <div className="milestone-row">
              <span className="milestone-index">02</span>
              <p className="text-sm leading-7 text-[var(--soft)]">
                Company in Paperclip provisionieren und Tenant-Mapping speichern.
              </p>
            </div>
            <div className="milestone-row">
              <span className="milestone-index">03</span>
              <p className="text-sm leading-7 text-[var(--soft)]">
                Deutsche Skills und DSGVO-Regeln zur Laufzeit injizieren.
              </p>
            </div>
          </div>
        </article>

        <article className="panel-shell">
          <div className="panel-header">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.28em] text-[var(--muted)]">
                Handoff
              </p>
              <h2 className="mt-3 text-2xl font-semibold tracking-[-0.03em]">
                Paperclip Übergabe
              </h2>
            </div>
          </div>

          <p className="text-sm leading-7 text-[var(--soft)]">
            Sobald Auth, Billing und Company-Provisioning stehen, wird dieses
            Dashboard zum Einstiegspunkt in die operative Paperclip-Ansicht.
          </p>

          <Link className="secondary-cta mt-6 inline-flex" href="/">
            Zurück zur Landingpage
          </Link>
        </article>
      </section>
    </main>
  );
}
