# AutopilotGmbH

AutopilotGmbH ist ein `wrapper-first` DACH-Launch um `Paperclip`.

Der Kunde sieht nur den Next.js-Wrapper unter `wrapper/`: Login, Launch Credits, Billing, Company-Start, Dashboard-Shell und die deutsche Betriebsoberfläche. `paperclip/` läuft dahinter als interner Execution-Core und wird über eine kontrollierte Bridge angesprochen.

## Architektur

- `wrapper/` ist die einzige öffentliche App.
- `paperclip/` bleibt privat im Docker-Netz und bekommt keine direkte Endkunden-Loginrolle.
- Company-Provisioning läuft über die interne Route `/api/internal/bootstrap-company`.
- Workspace-Zugriffe laufen über die Wrapper-Bridge unter `/api/paperclip/[...path]`.
- Der stabile Nutzer-Principal in Paperclip ist `clerk:<userId>`.
- Externe Heavy-Use-Tools sollen im Launch bevorzugt als `bring your own keys` angebunden werden.

## Repository

- `paperclip/` ist das Git-Submodule für den Execution-Core.
- `wrapper/` enthält die Next.js-Launch-App.
- `custom-skills/` enthält `autoresearch` und weitere repo-eigene Skills.
- `.claude/skills/` und `.agents/skills/` enthalten die Skill-Layer für Agenten und Claude-Workflows.
- `SKILLS.md` ist die deutsche DSGVO-/Operating-Policy.
- `docker-compose.prod.yml` beschreibt den Launch-Deploy auf einer einzelnen EU-Instanz.
- `.env.example` ist der minimale Runtime-Vertrag.

## Launch-Flow

1. Nutzer landet im Wrapper.
2. Clerk Sign-in oder Sign-up.
3. `/launch` entscheidet zentral: Sign-in, Credits/Billing, Provisioning oder Workspace.
4. `/start` bootstrapped die Company über die interne Paperclip-Bridge.
5. `/app/*` zeigt die native Launch-Shell mit kontrollierten Paperclip-Datenflächen.

## Deployment-Modell

Für den Launch ist das Ziel bewusst einfach:

- eine öffentliche Wrapper-URL
- ein privater Paperclip-Service im selben Compose-Netz
- externe Postgres-DB
- Clerk für Auth
- Stripe für Billing
- `INTERNAL_BRIDGE_SECRET` als Vertrauensanker zwischen Wrapper und Paperclip

Wichtig:

- `paperclip` läuft in `authenticated/private`
- `PAPERCLIP_AUTH_DISABLE_SIGN_UP=true`
- Endkunden loggen sich nicht direkt in Paperclip ein
- `paperclip` sollte nicht direkt ans Internet exponiert werden

## Quick Start

1. `.env.example` nach `.env` kopieren und Secrets setzen.
2. Submodules initialisieren:
   `git submodule update --init --recursive`
3. Optional lokale Skill-Setups ausführen:
   - `.claude/skills/gstack`: `./setup`
   - `custom-skills/autoresearch`: `uv sync` auf kompatiblem Linux/CUDA-Host
4. Launch-Stack starten:
   `docker compose -f docker-compose.prod.yml up --build`
5. Wrapper öffnen:
   [http://localhost:3000](http://localhost:3000)

## Wichtige Env-Variablen

- `APP_BASE_URL` und `NEXT_PUBLIC_APP_URL`: öffentliche Wrapper-URL
- `PAPERCLIP_INTERNAL_URL`: interne Docker-Adresse von Paperclip, typischerweise `http://paperclip:8080`
- `INTERNAL_BRIDGE_SECRET`: gemeinsames Secret für Provisioning und Workspace-Bridge
- `PAPERCLIP_DEPLOYMENT_MODE=authenticated`
- `PAPERCLIP_DEPLOYMENT_EXPOSURE=private`
- `PAPERCLIP_AUTH_DISABLE_SIGN_UP=true`
- `PAPERCLIP_ALLOWED_HOSTNAMES=paperclip`
- `PAPERCLIP_BRIDGE_READS_PER_MINUTE` und `PAPERCLIP_BRIDGE_WRITES_PER_MINUTE`: Launch-Guardrails gegen Poweruser-Spikes

## Hinweise

- `custom-skills/autoresearch` ist aktuell auf CUDA/Linux ausgelegt und läuft auf macOS ARM nicht vollständig.
- Die Launch-Bridge deckt aktuell bewusst nur eine kleine Allowlist produktiver Paperclip-Flächen ab.
- Redis/BullMQ und tiefere Queue-Steuerung sind noch nicht Teil dieses Compose-Schnitts.
