# Foundation Rescue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stabilize the current wrapper-first prototype into a production-safe control plane by freezing scope, moving business state toward Postgres, and shipping one reliable Service Engine path before widening the product.

**Architecture:** Keep the wrapper-first shape and existing public routes where possible, but stop deepening business state inside Clerk metadata. Introduce durable database-backed state, idempotent provisioning, immutable financial records, and a worker-driven run model in small, reviewable slices.

**Tech Stack:** Next.js App Router, TypeScript, Vitest, Clerk, Stripe, Postgres, Paperclip bridge

---

## Binding decisions from the 2026-03-22 source of truth

- Public promise: guided autonomy, not fully unsupervised autonomy.
- Primary wedge: Service Engine first.
- External packaging: named sprints / outcomes, not raw credits.
- Internal accounting: credits and provider cost remain internal control surfaces.
- Postgres becomes the source of truth for product state; Clerk is auth and entitlement mirror only.
- Every costly or irreversible action must become a durable run.
- No direct broad feature expansion before provisioning, billing, run orchestration, and observability are stabilized.

## Current repo mapping

- `wrapper/` currently contains the public app, authenticated app shell, onboarding, launch flow, billing surfaces, and the Paperclip bridge.
- `wrapper/lib/control-plane-store.ts` is the current transitional state layer and still leans on Clerk metadata.
- `wrapper/app/api/companies/provision/route.ts` is the current provisioning entrypoint and must become idempotent with durable state.
- `wrapper/lib/credits.ts`, Stripe routes, and related dashboard/start surfaces currently expose a credit-first model that needs to shift to sprint-first UI while preserving internal accounting.
- `paperclip/` remains the private execution core and should stay behind the bridge.

## Sequencing rule

Do not execute later tasks before earlier tasks are stable. In particular:

- Do not widen templates before Service Engine is complete.
- Do not promise broad autonomy before run visibility, retry safety, and approval gates exist.
- Do not deepen business state in Clerk metadata.

### Task 1: Freeze drift and install repo guardrails

**Files:**
- Create: `AGENTS.md`
- Modify: `README.md`
- Create: `docs/superpowers/specs/2026-03-22-foundation-rescue-design.md`

- [ ] **Step 1: Document the stabilization stance**

Add a short section in `README.md` that names the current phase as stabilization / foundation, with Service Engine first and Postgres-first as the active direction.

- [ ] **Step 2: Save the design summary**

Create `docs/superpowers/specs/2026-03-22-foundation-rescue-design.md` summarizing:
- current prototype status
- target architecture
- non-negotiables
- phased roadmap

- [ ] **Step 3: Verify docs render cleanly**

Run: `sed -n '1,200p' AGENTS.md && sed -n '1,220p' README.md`
Expected: rules and stabilization section appear with no malformed markdown.

- [ ] **Step 4: Commit**

```bash
git add AGENTS.md README.md docs/superpowers/specs/2026-03-22-foundation-rescue-design.md
git commit -m "docs: lock foundation rescue direction"
```

### Task 2: Create the wrapper database package and initial schema

**Files:**
- Create: `wrapper/prisma/schema.prisma` or the repo-standard DB schema location
- Create: `wrapper/lib/db/*` or `packages/db/*` once package layout is approved
- Test: `wrapper/tests/*` for repositories and migrations

- [ ] **Step 1: Write failing repository tests for workspace and venture reads**

Cover:
- create workspace
- create venture
- create venture spec version
- load dashboard/start state from DB-backed records

- [ ] **Step 2: Run the targeted tests**

Run the repo-standard DB test command for the new test file.
Expected: FAIL because the repositories and schema do not exist yet.

- [ ] **Step 3: Add the minimal schema**

Minimum tables:
- `workspace`
- `venture`
- `venture_spec`
- `billing_account`
- `credit_ledger`
- `usage_event`
- `run`
- `approval_gate`

- [ ] **Step 4: Implement repositories**

Create focused repository functions for:
- workspace by Clerk user id
- active venture lookup
- latest venture spec
- billing account lookup

- [ ] **Step 5: Re-run tests**

Expected: PASS for repository creation and read-path behavior.

- [ ] **Step 6: Commit**

```bash
git add wrapper/prisma wrapper/lib/db wrapper/tests
git commit -m "feat: add initial control plane schema and repositories"
```

### Task 3: Move launch/dashboard reads to DB-first with Clerk mirror fallback

**Files:**
- Modify: `wrapper/lib/control-plane-store.ts`
- Modify: `wrapper/lib/launch-entry.ts`
- Modify: `wrapper/lib/launch-flow.ts`
- Modify: `wrapper/app/start/page.tsx`
- Modify: `wrapper/app/dashboard/page.tsx`
- Test: `wrapper/tests/*launch*`

- [ ] **Step 1: Write failing tests for DB-first resolution**

Cover:
- DB state wins over Clerk metadata
- Clerk remains fallback when no DB record exists
- mirrored lightweight fields remain unchanged for auth-aware navigation

- [ ] **Step 2: Implement DB-first read path**

Keep the existing route structure stable.

- [ ] **Step 3: Re-run targeted tests**

Expected: PASS with existing public flow behavior preserved.

- [ ] **Step 4: Commit**

```bash
git add wrapper/lib/control-plane-store.ts wrapper/lib/launch-entry.ts wrapper/lib/launch-flow.ts wrapper/app/start/page.tsx wrapper/app/dashboard/page.tsx wrapper/tests
git commit -m "refactor: resolve launch state from database first"
```

### Task 4: Make provisioning durable and idempotent

**Files:**
- Modify: `wrapper/app/api/companies/provision/route.ts`
- Create: durable provisioning record model / repository
- Test: `wrapper/tests/provision*.test.ts`

- [ ] **Step 1: Write failing tests for duplicate and retry-safe provisioning**

Cover:
- double-click same request
- retry after transient upstream failure
- explicit states `pending|running|succeeded|failed|canceled`

- [ ] **Step 2: Implement durable provisioning record and lock**

Persist request identity, external ids, last error, retry eligibility, and timestamps.

- [ ] **Step 3: Re-run targeted tests**

Expected: repeated requests do not create duplicate Paperclip companies.

- [ ] **Step 4: Commit**

```bash
git add wrapper/app/api/companies/provision/route.ts wrapper/tests
git commit -m "feat: make provisioning idempotent and durable"
```

### Task 5: Introduce a worker-backed run engine

**Files:**
- Create: worker entrypoint and queue abstractions
- Create: run repositories and domain helpers
- Modify: provisioning and other long-running entrypoints to enqueue runs
- Test: worker and run lifecycle tests

- [ ] **Step 1: Write failing tests for run lifecycle**

Cover:
- `draft -> queued -> running -> succeeded`
- retry transition on retryable failure
- budget/timeout block
- approval wait state

- [ ] **Step 2: Implement minimal worker and queue**

Prefer a Postgres-backed queue first to minimize moving parts.

- [ ] **Step 3: Re-run run lifecycle tests**

Expected: PASS for queue pickup, retries, and state transitions.

- [ ] **Step 4: Commit**

```bash
git add apps/worker packages/domain packages/db wrapper/tests
git commit -m "feat: add durable run engine and worker"
```

### Task 6: Replace mutable credit math with an immutable ledger

**Files:**
- Modify: `wrapper/lib/credits.ts`
- Modify: Stripe webhook routes
- Modify: start/dashboard billing surfaces
- Test: credit ledger and webhook replay tests

- [ ] **Step 1: Write failing ledger tests**

Cover:
- grant
- debit
- refund
- technical failure reversal
- duplicate webhook replay

- [ ] **Step 2: Implement immutable entries**

Separate:
- customer-visible credit ledger
- internal `usage_event` cost records

- [ ] **Step 3: Re-run billing tests**

Expected: PASS with no technical failure leaving the user debited.

- [ ] **Step 4: Commit**

```bash
git add wrapper/lib/credits.ts wrapper/app/api/stripe wrapper/tests
git commit -m "refactor: move credits to immutable ledger"
```

### Task 7: Rewrite `/start` from credits-first to sprint-first

**Files:**
- Modify: `wrapper/app/start/page.tsx`
- Modify: `wrapper/components/launch-status-panel.tsx`
- Modify: any supporting launch copy helpers
- Test: `wrapper/tests/start-flow-guards.test.ts` and related UI tests

- [ ] **Step 1: Write failing tests for outcome-first copy**

Cover:
- named sprint / deliverable framing
- estimated credits, max credits, and refund-safe technical failure copy
- existing guarded behavior remains intact

- [ ] **Step 2: Implement minimal UI rewrite**

Do not add new payment logic in the UI layer.

- [ ] **Step 3: Re-run targeted tests**

Expected: PASS with same route and same guard behavior.

- [ ] **Step 4: Commit**

```bash
git add wrapper/app/start/page.tsx wrapper/components/launch-status-panel.tsx wrapper/tests
git commit -m "feat: rewrite start flow to sprint-first framing"
```

### Task 8: Add reliability surfaces before widening autonomy

**Files:**
- Modify: app shell surfaces that launch work
- Create: incident/retry status components
- Modify: health and readiness routes
- Test: route and component tests

- [ ] **Step 1: Write failing tests for retry-safe and status-aware UX**

Cover:
- visible run id
- explicit failure reason
- retry-safe wording
- no duplicate charge wording

- [ ] **Step 2: Implement reliability surfaces**

Add:
- run status
- retry state
- cost cap
- approval-needed state

- [ ] **Step 3: Re-run targeted tests**

Expected: PASS with clear failure and recovery states.

- [ ] **Step 4: Commit**

```bash
git add wrapper/app wrapper/components wrapper/tests
git commit -m "feat: add run reliability and retry-safe status surfaces"
```

### Task 9: Verify connectors and persist capabilities

**Files:**
- Modify: LLM and connector verification routes
- Create: `connector_binding` persistence
- Test: connector verification tests

- [ ] **Step 1: Write failing tests for verified capability flags**

Cover:
- verified
- blocked
- stale
- provider-specific capabilities

- [ ] **Step 2: Persist verification state**

Store status and capability flags durably rather than recomputing purely from metadata.

- [ ] **Step 3: Re-run tests**

Expected: PASS with DB-backed readiness state.

- [ ] **Step 4: Commit**

```bash
git add wrapper/app/api wrapper/lib wrapper/tests
git commit -m "feat: persist connector verification state"
```

### Task 10: Ship the first complete Service Engine path

**Files:**
- Modify: onboarding, app shell, workspace entry, revenue event handlers
- Add: Service Engine domain helpers and templates
- Test: end-to-end service path tests

- [ ] **Step 1: Write failing end-to-end tests for the first money path**

Cover:
- onboarding
- venture spec confirmation
- required connections verified
- first offer asset generated
- checkout enabled
- first revenue event recorded

- [ ] **Step 2: Implement the thinnest complete Service Engine**

Do not widen into marketplace or multi-template expansion.

- [ ] **Step 3: Re-run E2E and integration tests**

Expected: one user can reach first value, first offer, first checkout, and first revenue with durable state.

- [ ] **Step 4: Commit**

```bash
git add wrapper paperclip packages apps
git commit -m "feat: ship first complete service engine path"
```

## Verification sequence for the whole rescue program

- `pnpm --dir wrapper test`
- `pnpm --dir wrapper lint`
- `pnpm --dir wrapper build`
- DB migration smoke in staging
- Provisioning duplicate-request smoke
- Stripe webhook replay smoke
- Connector verification smoke
- End-to-end service engine smoke in staging

## Explicit anti-goals during this plan

- No autonomous YouTube engine as the primary launch path.
- No broad template marketplace.
- No deeper dependence on Clerk metadata.
- No “EU-only” or stronger compliance claims than the stack can support.
- No broad new feature wave before the foundation tasks above are stable.
