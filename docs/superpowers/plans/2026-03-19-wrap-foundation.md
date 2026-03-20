# WRAP Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first working WRAP foundation: Next.js frontend, Clerk + Stripe entry layer, Paperclip-backed company provisioning, external Postgres wiring, and runtime injection points for German skills.

**Architecture:** Paperclip remains the shared orchestration backend. A Next.js 15 frontend handles acquisition, auth, billing, and the provisioning handoff into Paperclip. Shared-instance isolation is enforced through company scoping plus Postgres row-level security.

**Tech Stack:** Next.js 15 App Router, TypeScript, Clerk, Stripe, Postgres, Docker Compose, Paperclip, Gstack skills, custom prompt injection

---

### Task 1: Refresh Repository Contracts

**Files:**
- Modify: `/Users/aibase/Documents/AI Comp/WRAP/README.md`
- Modify: `/Users/aibase/Documents/AI Comp/WRAP/.env.example`
- Modify: `/Users/aibase/Documents/AI Comp/WRAP/docker-compose.yml`
- Test: manual config review

- [ ] **Step 1: Write the failing contract checklist**

Define a checklist in notes or issue form covering:
- Paperclip is no longer described as a placeholder
- frontend service contract includes Next.js
- env contract includes Clerk, Stripe, Postgres, and Paperclip URLs
- compose describes external Postgres-ready configuration

- [ ] **Step 2: Review existing files and confirm gaps**

Run:

```bash
sed -n '1,220p' README.md
sed -n '1,220p' .env.example
sed -n '1,220p' docker-compose.yml
```

Expected: wording still reflects placeholder assumptions and needs updating.

- [ ] **Step 3: Update the contracts**

Make the docs and config skeleton match the approved architecture without overcommitting to unbuilt internals.

- [ ] **Step 4: Verify the contract is coherent**

Run:

```bash
sed -n '1,220p' README.md
sed -n '1,220p' .env.example
sed -n '1,260p' docker-compose.yml
```

Expected: all three files consistently describe the same deployment shape.

- [ ] **Step 5: Commit**

```bash
git add README.md .env.example docker-compose.yml
git commit -m "docs: align repo contracts with wrap architecture"
```

### Task 2: Scaffold The Next.js Frontend

**Files:**
- Create: `/Users/aibase/Documents/AI Comp/WRAP/frontend/package.json`
- Create: `/Users/aibase/Documents/AI Comp/WRAP/frontend/next.config.ts`
- Create: `/Users/aibase/Documents/AI Comp/WRAP/frontend/tsconfig.json`
- Create: `/Users/aibase/Documents/AI Comp/WRAP/frontend/src/app/layout.tsx`
- Create: `/Users/aibase/Documents/AI Comp/WRAP/frontend/src/app/page.tsx`
- Create: `/Users/aibase/Documents/AI Comp/WRAP/frontend/src/app/dashboard/page.tsx`
- Create: `/Users/aibase/Documents/AI Comp/WRAP/frontend/src/app/start/page.tsx`
- Create: `/Users/aibase/Documents/AI Comp/WRAP/frontend/src/app/globals.css`
- Test: `/Users/aibase/Documents/AI Comp/WRAP/frontend`

- [ ] **Step 1: Write the failing frontend boot test**

Create a minimal smoke check such as a build or lint target that currently fails because the app scaffold does not exist.

- [ ] **Step 2: Run the failing check**

Run:

```bash
cd frontend && npm run build
```

Expected: fail because `package.json` and the app scaffold are missing.

- [ ] **Step 3: Add the minimal Next.js 15 scaffold**

Create only the routes needed for:
- landing page
- authenticated dashboard shell
- company provisioning entrypoint

- [ ] **Step 4: Verify the frontend boots**

Run:

```bash
cd frontend && npm install
cd frontend && npm run build
```

Expected: successful production build.

- [ ] **Step 5: Commit**

```bash
git add frontend
git commit -m "feat: scaffold wrap frontend"
```

### Task 3: Add Clerk Authentication

**Files:**
- Modify: `/Users/aibase/Documents/AI Comp/WRAP/frontend/package.json`
- Create: `/Users/aibase/Documents/AI Comp/WRAP/frontend/src/lib/auth.ts`
- Modify: `/Users/aibase/Documents/AI Comp/WRAP/frontend/src/app/layout.tsx`
- Modify: `/Users/aibase/Documents/AI Comp/WRAP/frontend/src/app/dashboard/page.tsx`
- Test: `/Users/aibase/Documents/AI Comp/WRAP/frontend`

- [ ] **Step 1: Write the failing auth gate test**

Describe and encode a test or route expectation: unauthenticated users cannot access `/dashboard`.

- [ ] **Step 2: Run the failing auth check**

Run the chosen test or build check and confirm protected route logic is absent.

- [ ] **Step 3: Integrate Clerk with EU-ready env variables**

Add the minimal provider, middleware, and server-side auth helpers needed to guard private routes.

- [ ] **Step 4: Verify protected-route behavior**

Run:

```bash
cd frontend && npm run build
```

Expected: protected routes compile and unauthenticated access is redirected by the configured guard.

- [ ] **Step 5: Commit**

```bash
git add frontend .env.example
git commit -m "feat: add clerk authentication"
```

### Task 4: Add Stripe Billing Skeleton

**Files:**
- Modify: `/Users/aibase/Documents/AI Comp/WRAP/frontend/package.json`
- Create: `/Users/aibase/Documents/AI Comp/WRAP/frontend/src/lib/stripe.ts`
- Create: `/Users/aibase/Documents/AI Comp/WRAP/frontend/src/app/api/stripe/checkout/route.ts`
- Create: `/Users/aibase/Documents/AI Comp/WRAP/frontend/src/app/api/stripe/webhook/route.ts`
- Modify: `/Users/aibase/Documents/AI Comp/WRAP/frontend/src/app/page.tsx`
- Test: `/Users/aibase/Documents/AI Comp/WRAP/frontend`

- [ ] **Step 1: Write the failing billing-route test**

Define a test or invocation that expects a checkout session endpoint to exist.

- [ ] **Step 2: Run the failing billing check**

Call the route test or build and confirm the endpoint is missing.

- [ ] **Step 3: Implement the minimal Stripe flow**

Include:
- checkout session creation
- webhook signature verification
- billing status normalization stub

- [ ] **Step 4: Verify the billing skeleton**

Run:

```bash
cd frontend && npm run build
```

Expected: Stripe routes compile successfully with env-gated configuration.

- [ ] **Step 5: Commit**

```bash
git add frontend .env.example
git commit -m "feat: add stripe billing skeleton"
```

### Task 5: Discover And Implement Paperclip Provisioning Contract

**Files:**
- Modify: `/Users/aibase/Documents/AI Comp/WRAP/paperclip/...` exact files to be discovered
- Create: `/Users/aibase/Documents/AI Comp/WRAP/frontend/src/lib/paperclip.ts`
- Create: `/Users/aibase/Documents/AI Comp/WRAP/frontend/src/app/api/companies/start/route.ts`
- Test: integration path across `frontend/` and `paperclip/`

- [ ] **Step 1: Write the failing provisioning test**

Define the desired behavior:
- authenticated paid user calls "Firma starten"
- a Paperclip company is created exactly once
- a redirect URL or company handle is returned

- [ ] **Step 2: Run the failing provisioning check**

Run the new test or endpoint invocation and confirm no provisioning contract exists yet.

- [ ] **Step 3: Inspect Paperclip for company APIs**

Review the backend code to identify:
- company creation entrypoints
- auth and tenancy models
- any existing dashboard deep-link contract

- [ ] **Step 4: Implement a thin provisioning bridge**

Build the smallest possible integration from Next.js into Paperclip without forking unnecessary backend behavior.

- [ ] **Step 5: Verify end-to-end provisioning**

Run:

```bash
cd frontend && npm run build
```

Plus any targeted Paperclip test or script discovered during inspection.

Expected: the provisioning bridge compiles and the data flow is documented.

- [ ] **Step 6: Commit**

```bash
git add frontend paperclip
git commit -m "feat: add paperclip company provisioning bridge"
```

### Task 6: Add Postgres Mapping And Isolation Layer

**Files:**
- Create: `/Users/aibase/Documents/AI Comp/WRAP/frontend/src/lib/db.ts`
- Create: `/Users/aibase/Documents/AI Comp/WRAP/frontend/src/lib/company-mapping.ts`
- Create: migration files under `/Users/aibase/Documents/AI Comp/WRAP/frontend` or a dedicated db folder
- Test: database mapping and policy checks

- [ ] **Step 1: Write the failing company-mapping test**

Specify expected behavior for:
- one user to one primary company mapping
- no cross-company reads
- billing state associated to company records

- [ ] **Step 2: Run the failing database test**

Execute the chosen test command and confirm the mapping layer does not exist.

- [ ] **Step 3: Add schema and access helpers**

Create the minimal tables and access methods needed for user-company linkage and provisioning status.

- [ ] **Step 4: Add RLS-compatible query boundaries**

Keep policies or access helper semantics explicit so the isolation model is reviewable.

- [ ] **Step 5: Verify the mapping layer**

Run the targeted tests plus the frontend build.

- [ ] **Step 6: Commit**

```bash
git add frontend
git commit -m "feat: add company mapping layer"
```

### Task 7: Add Runtime Skill Injection

**Files:**
- Create or modify: `/Users/aibase/Documents/AI Comp/WRAP/frontend/src/lib/skills.ts`
- Modify: `/Users/aibase/Documents/AI Comp/WRAP/paperclip/...` exact injection points to be discovered
- Test: integration tests for injected prompt presence

- [ ] **Step 1: Write the failing injection test**

Define the expected output:
- `SKILLS.md` is loaded
- selected skill folders are resolved
- a provisioned company receives the German compliance layer at runtime

- [ ] **Step 2: Run the failing injection check**

Confirm there is currently no runtime loader or injection path.

- [ ] **Step 3: Implement the loader**

Keep it simple:
- load `SKILLS.md`
- resolve enabled skills from `custom-skills/`, `.claude/skills/`, and `.agents/skills/`
- pass the assembled prompt bundle into the discovered Paperclip integration point

- [ ] **Step 4: Verify injected content**

Run the targeted tests or a local script proving the assembled prompt contains the expected German compliance content.

- [ ] **Step 5: Commit**

```bash
git add frontend paperclip SKILLS.md custom-skills .claude/skills .agents/skills
git commit -m "feat: add runtime skill injection"
```

### Task 8: Make Docker Compose Match The Real Stack

**Files:**
- Modify: `/Users/aibase/Documents/AI Comp/WRAP/docker-compose.yml`
- Optionally create: `/Users/aibase/Documents/AI Comp/WRAP/frontend/Dockerfile`
- Optionally create: `/Users/aibase/Documents/AI Comp/WRAP/frontend/.dockerignore`
- Test: compose config validation and boot smoke test

- [ ] **Step 1: Write the failing deployment smoke test**

Use a config validation or boot expectation that fails against the current placeholder services.

- [ ] **Step 2: Run the failing deployment check**

Run:

```bash
docker compose config
```

Expected: current placeholder setup is incomplete or missing required build context for the real app.

- [ ] **Step 3: Replace placeholders with actual services**

Wire:
- external Postgres environment
- frontend build/runtime
- paperclip service using the checked-out backend

- [ ] **Step 4: Verify compose**

Run:

```bash
docker compose config
docker compose up --build
```

Expected: config resolves cleanly and services begin booting with the right environment contract.

- [ ] **Step 5: Commit**

```bash
git add docker-compose.yml frontend
git commit -m "feat: wire compose stack for wrap"
```

### Task 9: Final Verification And Customer-Facing Docs

**Files:**
- Modify: `/Users/aibase/Documents/AI Comp/WRAP/README.md`
- Test: whole-stack verification checklist

- [ ] **Step 1: Write the failing verification checklist**

List the minimum "done" conditions:
- signup works
- billing entrypoint exists
- company provisioning works
- Paperclip redirect works
- runtime prompts are injected
- compose contract is documented

- [ ] **Step 2: Run all verification commands**

Run the actual build and test commands discovered during implementation.

- [ ] **Step 3: Update README for customers**

Document:
- what WRAP is
- how to configure it
- how to start a company
- where compliance controls live

- [ ] **Step 4: Re-run verification**

Confirm the documentation still matches the working system.

- [ ] **Step 5: Commit**

```bash
git add README.md
git commit -m "docs: finalize wrap onboarding guide"
```
