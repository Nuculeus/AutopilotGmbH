# Launch Focus Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `/app/chat` into a focused launch workspace with reduced wrapper chrome and clearer German operational guidance.

**Architecture:** Add a chat-specific shell mode in the wrapper model and components. Keep the embedded workspace unchanged, but wrap it with a small launch action strip and a compact rail optimized for the first productive steps.

**Tech Stack:** Next.js App Router, React Server Components, Vitest, existing wrapper CSS.

---

### Task 1: Model the focus mode

**Files:**
- Modify: `wrapper/lib/app-shell.ts`
- Modify: `wrapper/app/app/layout.tsx`
- Test: `wrapper/tests/app-shell-routes.test.ts`

- [ ] Add a failing test for chat-specific focus mode and compact guidance.
- [ ] Run `pnpm exec vitest run tests/app-shell-routes.test.ts` and verify it fails for the new expectation.
- [ ] Extend the shell model with chat focus metadata and German next-step guidance.
- [ ] Re-run `pnpm exec vitest run tests/app-shell-routes.test.ts` and verify it passes.

### Task 2: Render a compact chat shell

**Files:**
- Modify: `wrapper/components/app-shell.tsx`
- Modify: `wrapper/components/app-sidebar.tsx`
- Modify: `wrapper/components/launch-status-panel.tsx`

- [ ] Implement focus-mode rendering with reduced topbar/rail treatment for `/app/chat`.
- [ ] Keep non-chat routes unchanged.

### Task 3: Add a launch action strip above the embedded workspace

**Files:**
- Modify: `wrapper/components/workspace-host-frame.tsx`
- Modify: `wrapper/app/app/chat/page.tsx`

- [ ] Add a slim German launch strip with the next meaningful actions.
- [ ] Keep the embedded workspace as the main surface.

### Task 4: Style and verify

**Files:**
- Modify: `wrapper/app/globals.css`

- [ ] Add only the CSS needed for focus-mode layout and compact launch actions.
- [ ] Run `pnpm exec vitest run tests/app-shell-routes.test.ts`
- [ ] Run `pnpm lint`
- [ ] Run `pnpm build`
