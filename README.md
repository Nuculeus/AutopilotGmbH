# AutopilotGmbH

AutopilotGmbH ist ein `wrapper-first` DACH-Launch um `Paperclip`.

Der Kunde sieht nur den Next.js-Wrapper unter `wrapper/`: Login, Onboarding, Start-Flow, Dashboard-Shell und die deutsche Betriebsoberfläche. `paperclip/` läuft dahinter als interner Execution-Core und wird über eine kontrollierte Bridge angesprochen.

## Aktueller Fokus: Stabilization / Foundation

Das Repository befindet sich derzeit bewusst in einer **Stabilization- und Foundation-Phase**, nicht in einer Feature-Expansionsphase.

Die verbindliche Richtung ist:

- **Service Engine first**
- **guided autonomy** statt vollautonomer Außenversprechen
- **Postgres als Ziel-Source-of-Truth**
- **Clerk nur für Auth und leichte Entitlement-Spiegelung**
- **keine Scope-Ausweitung**, bevor Provisioning, Billing, Run-Orchestrierung und Observability belastbar sind

Kurz gesagt: Wir machen den bestehenden Wrapper zuerst wahrheitsgetreu, zuverlässig und wiederholbar, bevor wir die Vision verbreitern.

## Aktueller Stand

Heute existiert bereits ein brauchbarer Wrapper-First-Prototyp mit:

- Landingpage und Login über Clerk
- geführtem Onboarding und Revenue-Track-Hinweisen
- Start-/Launch-Flächen
- deutscher App-Shell unter `/app/*`
- kontrollierter Paperclip-Bridge
- Stripe-, Credits- und Provisioning-Schnitten

Wichtig: Mehrere dieser Flächen sind **noch Prototypen oder Übergangslogik**, nicht finale produktionsreife Systeme.

## Zielarchitektur (noch nicht vollständig umgesetzt)

Der Zielzustand ist eine DB-gestützte Control Plane, bei der Postgres die Source of Truth für produktischen Venture- und Run-Zustand wird. Clerk bleibt dann für Auth, Entitlements und Spiegelung erhalten.

Geplante Kernobjekte:

- `workspaces`
- `ventures`
- `venture_specs`
- `connection_bindings`
- `run_executions`
- `experiments`
- `experiment_variants`
- `metric_events`
- `revenue_events`
- `credit_ledger`
- `approval_gates`

Geplante bzw. schrittweise einzuführende API-Flächen:

- `POST /api/ventures`
- `PATCH /api/ventures/:id/spec`
- `POST /api/runs`
- `POST /api/experiments`
- `POST /api/experiments/:id/decide`
- `POST /api/revenue/events` (erweitert um `source`, `attribution`, `runId`)

## Architektur

- `wrapper/` ist die einzige öffentliche App.
- `paperclip/` bleibt privat im Docker-Netz und bekommt keine direkte Endkunden-Loginrolle.
- Company-Provisioning läuft über die interne Route `/api/internal/bootstrap-company`.
- Workspace-Zugriffe laufen über die Wrapper-Bridge unter `/api/paperclip/[...path]`.
- Der stabile Nutzer-Principal in Paperclip ist `clerk:<userId>`.
- Externe Heavy-Use-Tools sollen im Launch bevorzugt als `bring your own keys` angebunden werden.

## Produktprinzipien

- **Primary wedge:** Service Engine first
- **Außenversprechen:** geführte Ergebnis-Pfade statt Tool-Chaos
- **Autonomie:** Guided, Semi-Auto, Autopilot nur innerhalb klarer Guardrails
- **Preismodell nach außen:** benannte Sprints / Outcomes
- **Accounting intern:** Credits und Provider-Kosten als interne Steuerung

## Repository

- `paperclip/` ist das Git-Submodule für den Execution-Core.
- `wrapper/` enthält die Next.js-Launch-App.
- `custom-skills/` enthält `autoresearch` und weitere repo-eigene Skills.
- `.claude/skills/` und `.agents/skills/` enthalten die Skill-Layer für Agenten und Claude-Workflows.
- `SKILLS.md` ist die deutsche DSGVO-/Operating-Policy.
- `docker-compose.prod.yml` beschreibt den produktionsnahen Launch-Deploy.
- `Caddyfile` stellt TLS und Reverse Proxying für den Wrapper bereit.
- `.env.example` ist der minimale Runtime-Vertrag.

## Launch-Flow

1. Nutzer landet im Wrapper.
2. Clerk Sign-in oder Sign-up.
3. `/launch` entscheidet zentral über Einstieg und nächsten sinnvollen Schritt.
4. `/start` und die zugehörigen Guided-Flächen führen in Onboarding, Setup und Provisioning.
5. `/app/*` zeigt die native Launch-Shell mit kontrollierten Paperclip-Datenflächen.

Hinweis: Dieser Flow wird aktuell aktiv von einem credits-first / provisioning-first Prototypen in einen outcome-first / run-first Foundation-Flow überführt.

## Production-Stack

Der produktionsnahe Compose-Schnitt ist:

- `caddy` für TLS und die öffentliche Domain
- `wrapper` als einzige öffentlich erreichbare App
- `paperclip` nur intern im Docker-Netz
- `postgres` als vorbereitete lokale Launch-DB

Wichtig:

- `caddy` routet nur auf `wrapper`
- `wrapper` spricht `paperclip` intern unter `http://paperclip:3100`
- `paperclip` läuft in `authenticated/private`
- `PAPERCLIP_AUTH_DISABLE_SIGN_UP=true`
- Endkunden loggen sich nie direkt in Paperclip ein

## Hetzner Quick Start

1. Repo klonen und Submodules holen:
   `git clone <repo> && cd WRAP && git submodule update --init --recursive`
2. `.env.example` nach `.env` kopieren und Production-Secrets setzen.
3. `APP_DOMAIN`, `APP_BASE_URL` und `NEXT_PUBLIC_APP_URL` auf die echte Domain setzen.
4. DNS-A-Record auf die Server-IP zeigen lassen.
5. Stack starten:
   `docker compose -f docker-compose.prod.yml up -d --build`

Caddy zieht danach das Zertifikat automatisch, sobald die Domain auf den Server zeigt.

## Wichtige Env-Variablen

- `APP_DOMAIN`: Domain für Caddy, z. B. `autopilotgmbh.de`
- `APP_BASE_URL` und `NEXT_PUBLIC_APP_URL`: öffentliche Wrapper-URL
- `PAPERCLIP_INTERNAL_URL`: interne Docker-Adresse von Paperclip, typischerweise `http://paperclip:3100`
- `INTERNAL_BRIDGE_SECRET`: gemeinsames Secret für Provisioning und Workspace-Bridge
- `PAPERCLIP_DEPLOYMENT_MODE=authenticated`
- `PAPERCLIP_DEPLOYMENT_EXPOSURE=private`
- `PAPERCLIP_AUTH_DISABLE_SIGN_UP=true`
- `PAPERCLIP_ALLOWED_HOSTNAMES=paperclip`
- `PAPERCLIP_BRIDGE_READS_PER_MINUTE` und `PAPERCLIP_BRIDGE_WRITES_PER_MINUTE`: Launch-Guardrails gegen Poweruser-Spikes
- `PAPERCLIP_BRIDGE_WORKSPACE_API_READS_PER_MINUTE` und `PAPERCLIP_BRIDGE_WORKSPACE_API_WRITES_PER_MINUTE`: separate Burst-Limits fuer Workspace-API-Aufrufe
- `AUTOPILOT_ENABLE_ADMIN_BILLING_BYPASS`, `AUTOPILOT_ADMIN_USER_IDS`, `AUTOPILOT_ADMIN_EMAILS`: optionaler Admin-Bypass fuer Billing-Tests ohne Stripe-Checkout

## Hinweise

- `custom-skills/autoresearch` ist aktuell auf CUDA/Linux ausgelegt und läuft auf macOS ARM nicht vollständig.
- Die Launch-Bridge deckt aktuell bewusst nur eine kleine Allowlist produktiver Paperclip-Flächen ab.
- Redis/BullMQ und tiefere Queue-Steuerung sind noch nicht Teil dieses Compose-Schnitts.
- Der Wrapper nutzt aktuell noch nicht durchgehend eine eigene DB-gestützte Domain- und Run-Logik; diese Foundation wird erst schrittweise umgesetzt.
- `docker compose config` konnte auf diesem Host zuletzt nicht geprüft werden, weil lokal kein `docker`-Binary installiert ist.
- Compliance-Wording im Produkt ist bewusst wahrheitsgetreu: **DSGVO-orientiert, EU-fokussiert, regionale Verarbeitung wo möglich**.

## Smoke Tests

Im Wrapper gibt es zwei direkte Smoke-Skripte:

- Auth-Flow (eingeloggt, inklusive Checkout-Einstieg):
  `pnpm --dir wrapper smoke:auth`
  - benoetigt `SMOKE_CLERK_SESSION_COOKIE` (oder `E2E_SESSION_COOKIE`)
  - optional `SMOKE_APP_URL`
- Stripe-Webhook (signierter Testevent gegen produktives Endpoint):
  `pnpm --dir wrapper smoke:stripe-webhook`
  - benoetigt `STRIPE_WEBHOOK_SECRET` und `SMOKE_CLERK_USER_ID`
  - optional `SMOKE_AMOUNT_CENTS`

Hinweis: der Admin-Billing-Bypass ist absichtlich `opt-in` und nur fuer allowlistete IDs/Emails gedacht. Fuer reale Kunden bleibt Stripe der Standardpfad.
