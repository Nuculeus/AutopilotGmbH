# Launch Hybrid Wrapper Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the launch-ready hybrid `AutopilotGmbH` experience: native wrapper onboarding, credits, billing, and company setup, plus controlled reuse of Paperclip workspace surfaces for fast DACH market entry.

**Architecture:** `wrapper/` stays the only customer-facing app and source of truth for auth, onboarding, credits, and billing. `paperclip/` remains the execution core. For launch, the wrapper provisions companies, stores company mapping plus lifecycle metadata, and exposes selected Paperclip workspace surfaces through a controlled server-side bridge instead of direct customer logins.

**Tech Stack:** Next.js 16 App Router, TypeScript, Clerk, Stripe, Vitest, Paperclip server, Better Auth internals, Docker Compose, Postgres-backed Paperclip services

---

### Task 1: Add A Launch Test Harness And Wrapper Metadata Contract

**Files:**
- Create: `/Users/aibase/Documents/AI Comp/WRAP/.worktrees/codex-wrapper-foundation/wrapper/vitest.config.ts`
- Create: `/Users/aibase/Documents/AI Comp/WRAP/.worktrees/codex-wrapper-foundation/wrapper/tests/autopilot-metadata.test.ts`
- Create: `/Users/aibase/Documents/AI Comp/WRAP/.worktrees/codex-wrapper-foundation/wrapper/lib/autopilot-metadata.ts`
- Modify: `/Users/aibase/Documents/AI Comp/WRAP/.worktrees/codex-wrapper-foundation/wrapper/lib/current-user.ts`
- Modify: `/Users/aibase/Documents/AI Comp/WRAP/.worktrees/codex-wrapper-foundation/wrapper/package.json`
- Modify: `/Users/aibase/Documents/AI Comp/WRAP/.worktrees/codex-wrapper-foundation/.env.example`

- [ ] **Step 1: Write the failing metadata tests**

Create tests that define the launch metadata contract. Cover:

```ts
it("starts users in free trial state with no company", () => {
  const state = summarizeAutopilotState({});
  expect(state.companyId).toBeNull();
  expect(state.provisioningStatus).toBe("not_started");
  expect(state.canOpenWorkspace).toBe(false);
});

it("marks a provisioned company as workspace-ready", () => {
  const state = summarizeAutopilotState({
    autopilotProvisioning: {
      companyId: "cmp_123",
      provisioningStatus: "active",
    },
  });
  expect(state.canOpenWorkspace).toBe(true);
});
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run:

```bash
cd /Users/aibase/Documents/AI\ Comp/WRAP/.worktrees/codex-wrapper-foundation/wrapper
pnpm add -D vitest
pnpm exec vitest run tests/autopilot-metadata.test.ts
```

Expected: FAIL because the metadata helper and contract do not exist yet.

- [ ] **Step 3: Implement the launch metadata helper**

Create a focused helper that normalizes all wrapper-owned launch state from Clerk metadata. It should model:

- `companyId`
- `companyName`
- `paperclipUserId` or internal bridge subject if needed
- `provisioningStatus`
- `workspaceStatus`
- `launchCreditsClaimed`
- `plan`
- `canOpenWorkspace`

Keep this separate from pricing math so the user-state boundary stays readable.

- [ ] **Step 4: Teach current-user loading to use the new contract**

Update the server-side user loader so all private routes get one coherent `AutopilotUserState` instead of reconstructing launch state ad hoc.

- [ ] **Step 5: Verify the tests pass and the app still builds**

Run:

```bash
cd /Users/aibase/Documents/AI\ Comp/WRAP/.worktrees/codex-wrapper-foundation/wrapper
pnpm exec vitest run tests/autopilot-metadata.test.ts
pnpm lint
pnpm build
```

Expected: metadata tests PASS, lint PASS, build PASS.

- [ ] **Step 6: Commit**

```bash
cd /Users/aibase/Documents/AI\ Comp/WRAP/.worktrees/codex-wrapper-foundation
git add wrapper/package.json wrapper/vitest.config.ts wrapper/tests/autopilot-metadata.test.ts wrapper/lib/autopilot-metadata.ts wrapper/lib/current-user.ts .env.example
git commit -m "test: add launch metadata contract"
```

### Task 2: Implement Wrapper-Owned Provisioning State And Start Flow Guards

**Files:**
- Create: `/Users/aibase/Documents/AI Comp/WRAP/.worktrees/codex-wrapper-foundation/wrapper/tests/start-flow-guards.test.ts`
- Modify: `/Users/aibase/Documents/AI Comp/WRAP/.worktrees/codex-wrapper-foundation/wrapper/app/start/page.tsx`
- Modify: `/Users/aibase/Documents/AI Comp/WRAP/.worktrees/codex-wrapper-foundation/wrapper/app/dashboard/page.tsx`
- Modify: `/Users/aibase/Documents/AI Comp/WRAP/.worktrees/codex-wrapper-foundation/wrapper/lib/current-user.ts`
- Modify: `/Users/aibase/Documents/AI Comp/WRAP/.worktrees/codex-wrapper-foundation/wrapper/lib/credits.ts`

- [ ] **Step 1: Write the failing start-flow guard tests**

Add tests for the launch decision rules:

```ts
it("shows company creation CTA when user has credits but no company", () => {});
it("shows provisioning state when company creation is pending", () => {});
it("offers workspace entry only when company status is active", () => {});
```

- [ ] **Step 2: Run the tests and confirm the guards are missing**

Run:

```bash
cd /Users/aibase/Documents/AI\ Comp/WRAP/.worktrees/codex-wrapper-foundation/wrapper
pnpm exec vitest run tests/start-flow-guards.test.ts
```

Expected: FAIL because current `/start` and `/dashboard` pages do not model provisioning lifecycle yet.

- [ ] **Step 3: Extend the server-rendered pages with explicit launch states**

Implement a minimal launch state machine in the UI:

- `not_started`
- `pending`
- `active`
- `failed`

The pages should stop pretending the workspace is available until the mapping says it is.

- [ ] **Step 4: Keep credits and provisioning concerns separate**

Refactor just enough so credit summary remains about usage, while the new helper answers:

- can this user create a company?
- can this user open the workspace?
- should this user see retry or support messaging?

- [ ] **Step 5: Verify test and app behavior**

Run:

```bash
cd /Users/aibase/Documents/AI\ Comp/WRAP/.worktrees/codex-wrapper-foundation/wrapper
pnpm exec vitest run tests/start-flow-guards.test.ts
pnpm lint
pnpm build
```

Expected: new guard tests PASS, lint PASS, build PASS.

- [ ] **Step 6: Commit**

```bash
cd /Users/aibase/Documents/AI\ Comp/WRAP/.worktrees/codex-wrapper-foundation
git add wrapper/tests/start-flow-guards.test.ts wrapper/app/start/page.tsx wrapper/app/dashboard/page.tsx wrapper/lib/current-user.ts wrapper/lib/credits.ts
git commit -m "feat: add provisioning state guards"
```

### Task 3: Build The Paperclip Admin Client And Company Provisioning Route

**Files:**
- Create: `/Users/aibase/Documents/AI Comp/WRAP/.worktrees/codex-wrapper-foundation/wrapper/tests/paperclip-provisioning.test.ts`
- Create: `/Users/aibase/Documents/AI Comp/WRAP/.worktrees/codex-wrapper-foundation/wrapper/lib/paperclip-admin.ts`
- Create: `/Users/aibase/Documents/AI Comp/WRAP/.worktrees/codex-wrapper-foundation/wrapper/app/api/companies/provision/route.ts`
- Create: `/Users/aibase/Documents/AI Comp/WRAP/.worktrees/codex-wrapper-foundation/paperclip/server/src/routes/internal.ts`
- Create: `/Users/aibase/Documents/AI Comp/WRAP/.worktrees/codex-wrapper-foundation/paperclip/server/src/middleware/internal-auth.ts`
- Modify: `/Users/aibase/Documents/AI Comp/WRAP/.worktrees/codex-wrapper-foundation/wrapper/lib/autopilot-metadata.ts`
- Modify: `/Users/aibase/Documents/AI Comp/WRAP/.worktrees/codex-wrapper-foundation/paperclip/server/src/app.ts`
- Modify: `/Users/aibase/Documents/AI Comp/WRAP/.worktrees/codex-wrapper-foundation/.env.example`
- Reference: `/Users/aibase/Documents/AI Comp/WRAP/.worktrees/codex-wrapper-foundation/paperclip/server/src/routes/companies.ts`
- Reference: `/Users/aibase/Documents/AI Comp/WRAP/.worktrees/codex-wrapper-foundation/paperclip/server/src/services/access.ts`

- [ ] **Step 1: Write the failing provisioning tests**

Encode the contract for the wrapper route:

```ts
it("creates one company and persists company metadata for the signed-in user", async () => {});
it("returns existing company metadata instead of creating duplicates", async () => {});
it("marks provisioning as failed when paperclip creation errors", async () => {});
```

- [ ] **Step 2: Run the tests and confirm the route is absent**

Run:

```bash
cd /Users/aibase/Documents/AI\ Comp/WRAP/.worktrees/codex-wrapper-foundation/wrapper
pnpm exec vitest run tests/paperclip-provisioning.test.ts
```

Expected: FAIL because the admin client and provisioning route do not exist.

- [ ] **Step 3: Implement a small Paperclip admin client**

Create a narrow wrapper-side client with only the launch methods:

- `bootstrapCompany`
- `getCompany`

Gate it behind env configuration instead of spreading raw fetch logic across routes.

- [ ] **Step 4: Add the Paperclip internal bootstrap route**

Implement a dedicated internal Paperclip route factory mounted under `/api/internal` that:

- requires an internal bridge secret
- creates the company using existing service-layer APIs
- assigns a stable bridge principal such as `clerk:<userId>` as company owner
- performs launch bootstrap work without overloading public company routes

- [ ] **Step 5: Implement the wrapper provisioning route with idempotency**

The route should:

- require Clerk auth
- reject users without available credits or paid access
- no-op if the user already has an active company mapping
- call the Paperclip internal bootstrap route
- persist `companyId`, `companyName`, and `provisioningStatus` back to wrapper-owned metadata

- [ ] **Step 6: Verify tests and app build**

Run:

```bash
cd /Users/aibase/Documents/AI\ Comp/WRAP/.worktrees/codex-wrapper-foundation/wrapper
pnpm exec vitest run tests/paperclip-provisioning.test.ts
pnpm lint
pnpm build
```

Then run a targeted Paperclip check:

```bash
cd /Users/aibase/Documents/AI\ Comp/WRAP/.worktrees/codex-wrapper-foundation/paperclip
pnpm test -- --runInBand internal
```

Expected: provisioning tests PASS, lint PASS, build PASS, and the Paperclip internal route compiles or passes its targeted test.

- [ ] **Step 7: Commit**

```bash
cd /Users/aibase/Documents/AI\ Comp/WRAP/.worktrees/codex-wrapper-foundation
git add wrapper/tests/paperclip-provisioning.test.ts wrapper/lib/paperclip-admin.ts wrapper/app/api/companies/provision/route.ts wrapper/lib/autopilot-metadata.ts paperclip/server/src/routes/internal.ts paperclip/server/src/middleware/internal-auth.ts paperclip/server/src/app.ts .env.example
git commit -m "feat: add paperclip provisioning route"
```

### Task 4: Create The Native Launch App Shell

**Files:**
- Create: `/Users/aibase/Documents/AI Comp/WRAP/.worktrees/codex-wrapper-foundation/wrapper/tests/app-shell-routes.test.tsx`
- Create: `/Users/aibase/Documents/AI Comp/WRAP/.worktrees/codex-wrapper-foundation/wrapper/app/(app)/layout.tsx`
- Create: `/Users/aibase/Documents/AI Comp/WRAP/.worktrees/codex-wrapper-foundation/wrapper/app/(app)/overview/page.tsx`
- Create: `/Users/aibase/Documents/AI Comp/WRAP/.worktrees/codex-wrapper-foundation/wrapper/app/(app)/chat/page.tsx`
- Create: `/Users/aibase/Documents/AI Comp/WRAP/.worktrees/codex-wrapper-foundation/wrapper/app/(app)/company-hq/page.tsx`
- Create: `/Users/aibase/Documents/AI Comp/WRAP/.worktrees/codex-wrapper-foundation/wrapper/app/(app)/apps/page.tsx`
- Create: `/Users/aibase/Documents/AI Comp/WRAP/.worktrees/codex-wrapper-foundation/wrapper/app/(app)/connections/page.tsx`
- Create: `/Users/aibase/Documents/AI Comp/WRAP/.worktrees/codex-wrapper-foundation/wrapper/components/app-shell.tsx`
- Create: `/Users/aibase/Documents/AI Comp/WRAP/.worktrees/codex-wrapper-foundation/wrapper/components/app-sidebar.tsx`
- Create: `/Users/aibase/Documents/AI Comp/WRAP/.worktrees/codex-wrapper-foundation/wrapper/components/launch-status-panel.tsx`
- Modify: `/Users/aibase/Documents/AI Comp/WRAP/.worktrees/codex-wrapper-foundation/wrapper/app/globals.css`
- Modify: `/Users/aibase/Documents/AI Comp/WRAP/.worktrees/codex-wrapper-foundation/wrapper/proxy.ts`

- [ ] **Step 1: Write the failing shell route tests**

Add tests for:

- shell renders navigation for `Chat`, `Übersicht`, `Company HQ`, `Apps`, `Connections`
- shell shows credit and trial state from server data
- shell blocks workspace routes when provisioning is not active

- [ ] **Step 2: Run the tests and confirm the shell does not exist**

Run:

```bash
cd /Users/aibase/Documents/AI\ Comp/WRAP/.worktrees/codex-wrapper-foundation/wrapper
pnpm exec vitest run tests/app-shell-routes.test.tsx
```

Expected: FAIL because the grouped app shell and routes do not exist.

- [ ] **Step 3: Implement the grouped app layout**

Create a wrapper-owned launch shell that feels close to Naive's information architecture but remains branded and DACH-focused. Keep the first version intentionally small:

- left navigation
- top-level status banner
- plan and credit summary
- checklist / setup rail

- [ ] **Step 4: Point existing flows into the new shell**

Update redirects and CTAs so `/start` and `/dashboard` route naturally toward the grouped app routes instead of dead-end placeholders.

- [ ] **Step 5: Verify shell tests and app build**

Run:

```bash
cd /Users/aibase/Documents/AI\ Comp/WRAP/.worktrees/codex-wrapper-foundation/wrapper
pnpm exec vitest run tests/app-shell-routes.test.tsx
pnpm lint
pnpm build
```

Expected: shell tests PASS, lint PASS, build PASS.

- [ ] **Step 6: Commit**

```bash
cd /Users/aibase/Documents/AI\ Comp/WRAP/.worktrees/codex-wrapper-foundation
git add wrapper/app wrapper/components wrapper/proxy.ts
git commit -m "feat: add launch app shell"
```

### Task 5: Add A Controlled Paperclip Workspace Bridge

**Files:**
- Create: `/Users/aibase/Documents/AI Comp/WRAP/.worktrees/codex-wrapper-foundation/wrapper/tests/paperclip-bridge.test.ts`
- Create: `/Users/aibase/Documents/AI Comp/WRAP/.worktrees/codex-wrapper-foundation/wrapper/lib/paperclip-bridge.ts`
- Create: `/Users/aibase/Documents/AI Comp/WRAP/.worktrees/codex-wrapper-foundation/wrapper/app/api/paperclip/[...path]/route.ts`
- Modify: `/Users/aibase/Documents/AI Comp/WRAP/.worktrees/codex-wrapper-foundation/wrapper/app/(app)/chat/page.tsx`
- Modify: `/Users/aibase/Documents/AI Comp/WRAP/.worktrees/codex-wrapper-foundation/wrapper/app/(app)/overview/page.tsx`
- Modify: `/Users/aibase/Documents/AI Comp/WRAP/.worktrees/codex-wrapper-foundation/wrapper/app/(app)/company-hq/page.tsx`
- Modify: `/Users/aibase/Documents/AI Comp/WRAP/.worktrees/codex-wrapper-foundation/wrapper/app/(app)/apps/page.tsx`
- Modify: `/Users/aibase/Documents/AI Comp/WRAP/.worktrees/codex-wrapper-foundation/wrapper/app/(app)/connections/page.tsx`

- [ ] **Step 1: Write the failing bridge tests**

Define the bridge guarantees:

```ts
it("rejects proxy requests when the signed-in user has no active company", async () => {});
it("forwards allowed paperclip paths for the mapped company only", async () => {});
it("never trusts client-supplied companyId query parameters", async () => {});
it("authenticates proxied workspace requests as the stable bridge principal for that user", async () => {});
```

- [ ] **Step 2: Run the tests and confirm the bridge is missing**

Run:

```bash
cd /Users/aibase/Documents/AI\ Comp/WRAP/.worktrees/codex-wrapper-foundation/wrapper
pnpm exec vitest run tests/paperclip-bridge.test.ts
```

Expected: FAIL because no bridge helper or proxy route exists.

- [ ] **Step 3: Implement a bridge helper with an allowlist**

Start with a strict allowlist of launch routes and asset patterns only. The helper should:

- resolve current user state
- derive the mapped company from metadata
- inject wrapper-controlled auth toward Paperclip
- identify the user as the same stable bridge principal created during bootstrap
- reject any path outside the launch workspace surface

- [ ] **Step 4: Connect the app routes to the bridge**

The launch routes should present branded wrapper framing while pointing their inner operational surface at the controlled bridge, not directly at Paperclip origin URLs.

- [ ] **Step 5: Verify tests and app build**

Run:

```bash
cd /Users/aibase/Documents/AI\ Comp/WRAP/.worktrees/codex-wrapper-foundation/wrapper
pnpm exec vitest run tests/paperclip-bridge.test.ts
pnpm lint
pnpm build
```

Expected: bridge tests PASS, lint PASS, build PASS.

- [ ] **Step 6: Commit**

```bash
cd /Users/aibase/Documents/AI\ Comp/WRAP/.worktrees/codex-wrapper-foundation
git add wrapper/tests/paperclip-bridge.test.ts wrapper/lib/paperclip-bridge.ts wrapper/app/api/paperclip/[...path]/route.ts wrapper/app/(app)
git commit -m "feat: add paperclip workspace bridge"
```

### Task 6: Wire Onboarding, Credits, Billing, And Workspace Entry Together

**Files:**
- Create: `/Users/aibase/Documents/AI Comp/WRAP/.worktrees/codex-wrapper-foundation/wrapper/tests/launch-entry-flow.test.ts`
- Modify: `/Users/aibase/Documents/AI Comp/WRAP/.worktrees/codex-wrapper-foundation/wrapper/app/page.tsx`
- Modify: `/Users/aibase/Documents/AI Comp/WRAP/.worktrees/codex-wrapper-foundation/wrapper/app/start/page.tsx`
- Modify: `/Users/aibase/Documents/AI Comp/WRAP/.worktrees/codex-wrapper-foundation/wrapper/app/dashboard/page.tsx`
- Modify: `/Users/aibase/Documents/AI Comp/WRAP/.worktrees/codex-wrapper-foundation/wrapper/app/api/credits/claim/route.ts`
- Modify: `/Users/aibase/Documents/AI Comp/WRAP/.worktrees/codex-wrapper-foundation/wrapper/app/api/stripe/checkout/route.ts`
- Modify: `/Users/aibase/Documents/AI Comp/WRAP/.worktrees/codex-wrapper-foundation/wrapper/app/api/stripe/webhook/route.ts`

- [ ] **Step 1: Write the failing end-to-end flow tests**

Model the launch sequence:

```ts
it("lets a new user claim credits, provision a company, and open the workspace", async () => {});
it("sends a paid user without a company into provisioning before workspace access", async () => {});
it("keeps a failed provisioning user on wrapper-owned recovery UI", async () => {});
```

- [ ] **Step 2: Run the tests and confirm the flow is incomplete**

Run:

```bash
cd /Users/aibase/Documents/AI\ Comp/WRAP/.worktrees/codex-wrapper-foundation/wrapper
pnpm exec vitest run tests/launch-entry-flow.test.ts
```

Expected: FAIL because credits, billing, provisioning, and workspace entry are not yet stitched together.

- [ ] **Step 3: Normalize the launch entry rules**

Implement the decision tree in one place:

- unauthenticated -> sign in
- authenticated + no credits/plan -> pricing or checkout
- authenticated + credits/plan + no company -> provision
- authenticated + active company -> workspace entry
- authenticated + failed provisioning -> retry / support state

- [ ] **Step 4: Update CTAs and redirects to follow the decision tree**

Avoid scattered redirects. Every launch CTA should send the user to the same entry logic.

- [ ] **Step 5: Verify tests and app build**

Run:

```bash
cd /Users/aibase/Documents/AI\ Comp/WRAP/.worktrees/codex-wrapper-foundation/wrapper
pnpm exec vitest run tests/launch-entry-flow.test.ts
pnpm lint
pnpm build
```

Expected: launch flow tests PASS, lint PASS, build PASS.

- [ ] **Step 6: Commit**

```bash
cd /Users/aibase/Documents/AI\ Comp/WRAP/.worktrees/codex-wrapper-foundation
git add wrapper/app wrapper/tests
git commit -m "feat: wire launch onboarding and workspace entry"
```

### Task 7: Update Environment, Compose, And Customer Docs For The Hybrid Launch

**Files:**
- Modify: `/Users/aibase/Documents/AI Comp/WRAP/.worktrees/codex-wrapper-foundation/.env.example`
- Modify: `/Users/aibase/Documents/AI Comp/WRAP/.worktrees/codex-wrapper-foundation/docker-compose.prod.yml`
- Modify: `/Users/aibase/Documents/AI Comp/WRAP/.worktrees/codex-wrapper-foundation/README.md`

- [ ] **Step 1: Write the failing deployment checklist**

List the required launch env and runtime contracts:

- wrapper can reach paperclip internally
- paperclip is not a direct public login surface
- internal bridge secrets are configured
- Clerk, Stripe, and Paperclip URLs are documented

- [ ] **Step 2: Review current files and confirm the gaps**

Run:

```bash
cd /Users/aibase/Documents/AI\ Comp/WRAP/.worktrees/codex-wrapper-foundation
sed -n '1,260p' .env.example
sed -n '1,260p' docker-compose.prod.yml
sed -n '1,260p' README.md
```

Expected: launch bridge envs and operational docs are incomplete.

- [ ] **Step 3: Update the production contract**

Document the minimum launch envs, including placeholders for:

- `PAPERCLIP_INTERNAL_URL`
- bridge auth secret or admin credentials
- wrapper public URL
- Clerk keys
- Stripe keys and price IDs

Keep the compose file aligned with the chosen launch mode.

- [ ] **Step 4: Verify the contract is coherent**

Run:

```bash
cd /Users/aibase/Documents/AI\ Comp/WRAP/.worktrees/codex-wrapper-foundation
sed -n '1,260p' .env.example
sed -n '1,260p' docker-compose.prod.yml
sed -n '1,260p' README.md
```

Expected: docs and envs describe the same hybrid launch deployment.

- [ ] **Step 5: Commit**

```bash
cd /Users/aibase/Documents/AI\ Comp/WRAP/.worktrees/codex-wrapper-foundation
git add .env.example docker-compose.prod.yml README.md
git commit -m "docs: document hybrid launch deployment"
```
