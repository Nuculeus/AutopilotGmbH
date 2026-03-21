# Chat Workspace Bridge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `/app/chat` placeholder with a real Paperclip-backed workspace delivered through the wrapper's authenticated company bridge.

**Architecture:** `wrapper/` remains the customer-facing application and source of truth for identity and company access. `paperclip/` remains the runtime. `/app/chat` becomes a wrapper-owned host route that proxies only the minimal Paperclip workspace surface required for launch, using the stable `clerk:<userId>` principal and a strict allowlist.

**Tech Stack:** Next.js 16 App Router, TypeScript, Clerk, Vitest, Paperclip server/UI, Docker Compose

---

### Task 1: Discover The Real Paperclip Chat Surface Contract

**Files:**
- Inspect: `/Users/aibase/Documents/AI Comp/WRAP/paperclip/ui/src/App.tsx`
- Inspect: `/Users/aibase/Documents/AI Comp/WRAP/paperclip/ui/src/lib/router.tsx`
- Inspect: `/Users/aibase/Documents/AI Comp/WRAP/paperclip/ui/src/pages/*.tsx`
- Inspect: `/Users/aibase/Documents/AI Comp/WRAP/paperclip/server/src/routes/*.ts`
- Create: `/Users/aibase/Documents/AI Comp/WRAP/wrapper/tests/chat-workspace-allowlist.test.ts`

- [ ] **Step 1: Identify the actual chat workspace route and supporting requests**

Read the Paperclip UI routing and note:

- the route path used for the main chat or board workspace
- which assets it loads
- which API endpoints it calls on first render

- [ ] **Step 2: Write the failing allowlist test**

Add tests that define the launch proxy contract:

```ts
it("allows the launch chat workspace entry route", () => {});
it("allows only the minimal workspace support routes", () => {});
it("rejects unrelated admin or instance routes", () => {});
```

- [ ] **Step 3: Run the test to confirm the allowlist contract is not implemented**

Run:

```bash
cd /Users/aibase/Documents/AI\ Comp/WRAP/wrapper
pnpm test -- tests/chat-workspace-allowlist.test.ts
```

Expected: FAIL because the bridge does not yet know about the real chat workspace surface.

- [ ] **Step 4: Commit**

```bash
git add wrapper/tests/chat-workspace-allowlist.test.ts
git commit -m "test: define chat workspace allowlist"
```

### Task 2: Extend The Bridge For Workspace HTML, Assets, And API Calls

**Files:**
- Modify: `/Users/aibase/Documents/AI Comp/WRAP/wrapper/lib/paperclip-bridge.ts`
- Modify: `/Users/aibase/Documents/AI Comp/WRAP/wrapper/app/api/paperclip/[...path]/route.ts`
- Test: `/Users/aibase/Documents/AI Comp/WRAP/wrapper/tests/chat-workspace-allowlist.test.ts`

- [ ] **Step 1: Implement route classification for workspace requests**

Add minimal route specs for:

- workspace entry HTML
- required static asset paths
- required API endpoints

Keep the allowlist explicit and small.

- [ ] **Step 2: Preserve the existing security model**

Ensure the bridge still:

- rejects requests without a mapped company
- strips client-provided tenancy values
- uses `clerk:<userId>` as the upstream bridge principal
- rate-limits requests

- [ ] **Step 3: Forward non-JSON workspace responses correctly**

Update the bridge response handling so HTML, JS, CSS, and other content types survive intact instead of assuming JSON-only behavior.

- [ ] **Step 4: Run the tests**

Run:

```bash
cd /Users/aibase/Documents/AI\ Comp/WRAP/wrapper
pnpm test -- tests/chat-workspace-allowlist.test.ts tests/paperclip-bridge.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add wrapper/lib/paperclip-bridge.ts wrapper/app/api/paperclip/[...path]/route.ts wrapper/tests/chat-workspace-allowlist.test.ts
git commit -m "feat: allow bridged chat workspace routes"
```

### Task 3: Replace The Placeholder Chat Page With A Real Workspace Host

**Files:**
- Create: `/Users/aibase/Documents/AI Comp/WRAP/wrapper/components/workspace-host-frame.tsx`
- Modify: `/Users/aibase/Documents/AI Comp/WRAP/wrapper/app/app/chat/page.tsx`
- Modify: `/Users/aibase/Documents/AI Comp/WRAP/wrapper/components/app-shell.tsx`
- Modify: `/Users/aibase/Documents/AI Comp/WRAP/wrapper/components/app-sidebar.tsx`
- Modify: `/Users/aibase/Documents/AI Comp/WRAP/wrapper/app/globals.css`
- Create: `/Users/aibase/Documents/AI Comp/WRAP/wrapper/tests/chat-page.test.tsx`

- [ ] **Step 1: Write the failing chat page test**

Define the intended behavior:

```tsx
it("renders a real workspace host instead of the placeholder copy", () => {});
it("keeps wrapper-owned recovery UI when workspace access is blocked", () => {});
```

- [ ] **Step 2: Run the test and confirm the placeholder is still present**

Run:

```bash
cd /Users/aibase/Documents/AI\ Comp/WRAP/wrapper
pnpm test -- tests/chat-page.test.tsx
```

Expected: FAIL because `/app/chat` still renders launch placeholder content.

- [ ] **Step 3: Implement the workspace host frame**

Build a focused component that:

- keeps minimal wrapper framing
- points the main workspace surface at the bridged Paperclip route
- makes it obvious the user is in the real operating area

- [ ] **Step 4: Replace placeholder content**

Update `/app/chat` so it renders the workspace host when access is ready and falls back to wrapper-owned blocked states otherwise.

- [ ] **Step 5: Verify**

Run:

```bash
cd /Users/aibase/Documents/AI\ Comp/WRAP/wrapper
pnpm test -- tests/chat-page.test.tsx tests/app-shell-routes.test.ts
pnpm lint
pnpm build
```

Expected: PASS, and `/app/chat` is no longer a placeholder.

- [ ] **Step 6: Commit**

```bash
git add wrapper/components/workspace-host-frame.tsx wrapper/app/app/chat/page.tsx wrapper/components/app-shell.tsx wrapper/components/app-sidebar.tsx wrapper/app/globals.css wrapper/tests/chat-page.test.tsx
git commit -m "feat: host bridged workspace in chat route"
```

### Task 4: Verify The End-To-End Workspace Path

**Files:**
- Modify as needed: `/Users/aibase/Documents/AI Comp/WRAP/wrapper/tests/*`
- Optional docs: `/Users/aibase/Documents/AI Comp/WRAP/README.md`

- [ ] **Step 1: Add a narrow regression test for post-provision workspace entry**

Cover:

```ts
it("routes a provisioned user from launch into the real chat workspace", () => {});
```

- [ ] **Step 2: Run the full wrapper verification set**

Run:

```bash
cd /Users/aibase/Documents/AI\ Comp/WRAP/wrapper
pnpm test
pnpm lint
pnpm build
```

Expected: all tests pass, lint passes, build passes.

- [ ] **Step 3: Redeploy and smoke test**

Run on the server:

```bash
cd /root/AutopilotGmbH
git pull --ff-only
git submodule update --init --recursive
docker compose -f docker-compose.prod.yml up -d --build wrapper paperclip
```

Then verify in browser:

- sign in
- provision company if needed
- open `/app/chat`
- confirm real workspace loads
- confirm unrelated Paperclip routes remain unavailable

- [ ] **Step 4: Commit**

```bash
git add wrapper/tests README.md
git commit -m "test: verify bridged chat workspace launch path"
```
