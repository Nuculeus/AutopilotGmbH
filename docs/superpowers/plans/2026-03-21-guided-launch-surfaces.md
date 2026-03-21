# Guided Launch Surfaces Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `Company HQ`, `Connections`, and `Apps` feel like simple, useful first-product surfaces for launch users.

**Architecture:** Keep the real runtime underneath, but place a wrapper-owned German guidance layer above each surface. Each page gets a simple orientation section, a clear primary action, and a deeper secondary section below.

**Tech Stack:** Next.js App Router, React Server Components, existing wrapper shell/components, Vitest, wrapper CSS.

---

### Task 1: Extend the shell model for guided launch surfaces

**Files:**
- Modify: `wrapper/lib/app-shell.ts`
- Test: `wrapper/tests/app-shell-routes.test.ts`

- [ ] **Step 1: Write the failing test**

Add assertions for route-specific guidance on:
- `/app/company-hq`
- `/app/connections`
- `/app/apps`

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/app-shell-routes.test.ts`
Expected: FAIL because route-specific guidance does not exist yet

- [ ] **Step 3: Write minimal implementation**

Extend the shell model so these routes can render:
- a page mode
- a primary next-step CTA
- a short German route summary

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run tests/app-shell-routes.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add wrapper/lib/app-shell.ts wrapper/tests/app-shell-routes.test.ts
git commit -m "feat: add guided launch shell metadata"
```

### Task 2: Turn Company HQ into a guided business setup surface

**Files:**
- Modify: `wrapper/app/app/company-hq/page.tsx`
- Modify: `wrapper/components/app-shell.tsx`
- Modify: `wrapper/app/globals.css`

- [ ] **Step 1: Write the failing test**

Add a focused render test or route-model test expectation for a Company HQ primary CTA and intake framing.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/app-shell-routes.test.ts`
Expected: FAIL for missing Company HQ launch guidance

- [ ] **Step 3: Write minimal implementation**

Render a simple guided Company HQ surface with:
- short intro
- one primary CTA
- compact structured business-identity intake block

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run tests/app-shell-routes.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add wrapper/app/app/company-hq/page.tsx wrapper/components/app-shell.tsx wrapper/app/globals.css
git commit -m "feat: guide company hq launch setup"
```

### Task 3: Turn Connections into plug-and-play first, catalog second

**Files:**
- Modify: `wrapper/app/app/connections/page.tsx`
- Modify: `wrapper/components/connections-manager.tsx`
- Modify: `wrapper/app/globals.css`

- [ ] **Step 1: Write the failing test**

Add a test expectation for prioritized launch connections and a top-level plug-and-play CTA band.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/app-shell-routes.test.ts`
Expected: FAIL because connections are not yet prioritized in the wrapper guidance

- [ ] **Step 3: Write minimal implementation**

Add:
- a top plug-and-play guidance section
- prioritized starter connections
- deeper catalog below

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run tests/app-shell-routes.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add wrapper/app/app/connections/page.tsx wrapper/components/connections-manager.tsx wrapper/app/globals.css
git commit -m "feat: prioritize launch connections guidance"
```

### Task 4: Turn Apps into a real starter layer

**Files:**
- Modify: `wrapper/app/app/apps/page.tsx`
- Modify: `wrapper/app/globals.css`

- [ ] **Step 1: Write the failing test**

Add a test expectation for a curated starter set of launch-safe app entry points.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/app-shell-routes.test.ts`
Expected: FAIL because apps do not yet expose launch starter options

- [ ] **Step 3: Write minimal implementation**

Render a small set of real starter options:
- landing page
- lead capture
- SEO page
- support workflow
- internal operations page

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run tests/app-shell-routes.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add wrapper/app/app/apps/page.tsx wrapper/app/globals.css
git commit -m "feat: add launch starter app surface"
```

### Task 5: Verify the full launch-surface pass

**Files:**
- Verify only

- [ ] **Step 1: Run focused tests**

Run: `pnpm exec vitest run tests/app-shell-routes.test.ts`
Expected: PASS

- [ ] **Step 2: Run lint**

Run: `pnpm lint`
Expected: PASS

- [ ] **Step 3: Run production build**

Run: `pnpm build`
Expected: PASS

- [ ] **Step 4: Commit final polish**

```bash
git add wrapper
git commit -m "feat: ship guided launch workspace surfaces"
```
