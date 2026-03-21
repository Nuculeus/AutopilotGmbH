# Guided Launch Surfaces Design

**Goal:** Turn `Company HQ`, `Connections`, and `Apps` into the first truly useful operational surfaces for launch users, with the simplest possible UX.

## Core Principle

Do not pretend a deep platform already exists. Show only what is real, but arrange it so the user immediately understands what to do next.

For launch, each surface should answer a single simple question:

- `Company HQ`: "What kind of company am I building?"
- `Connections`: "What should I connect first so this company can act?"
- `Apps`: "What should I launch first?"

## Product Positioning

This is not an English-first early-adopter tool. The wrapper should guide a German-speaking mainstream user through the first business-building steps with clear language and obvious actions.

The embedded runtime can remain partially English where needed, but the wrapper-owned guidance layer must stay simple, practical, and German.

## Surface 1: Company HQ

`Company HQ` becomes the first setup workspace for company identity.

Instead of a mostly empty knowledge view, the launch surface should provide:

- a short German intro explaining why this matters
- one primary CTA to start
- a compact structured intake for:
  - company goal
  - offer
  - target audience
  - tone/brand style
  - current top priorities

This should feel like "describe your business once, so your operators can work better."

### UX rules

- Keep it guided, not open-ended
- Prefer one main form and one main CTA
- Avoid deep navigation or complex information architecture

## Surface 2: Connections

`Connections` should emphasize plug-and-play first, catalog second.

The top of the page should show a simple German action band:

- why connections matter
- which connections are most useful first
- one-click paths into the most relevant setup actions

Below that, the broader connections catalog can remain visible for users who want more depth.

### Launch priority connections

Show a small prioritized starter set first:

- Stripe
- Google
- Anthropic / model provider

Everything else can stay below as the broader runtime catalog.

### UX rules

- Top section = orientation and first actions
- Lower section = deeper catalog
- Do not force the user to scan a large grid before understanding what to do

## Surface 3: Apps

`Apps` should become a real starter layer into the future app platform, not a fake fully developed app marketplace.

For launch, show a small set of concrete starter paths:

- landing page
- lead capture page
- SEO page
- support workflow
- internal operations page

These should be framed as "first building blocks" rather than a complete platform promise.

### UX rules

- show only a few launch-safe options
- each option should explain what it is for in one sentence
- use one obvious CTA per option

## Shared UX Pattern

All three pages should follow the same launch pattern:

1. short German orientation
2. one obvious next action
3. deeper surface below for advanced users

This keeps the wrapper simple for mainstream users while still allowing depth underneath.

## Non-goals

- No fake enterprise complexity
- No giant wizard flow across all three sections
- No heavy abstraction that hides the real runtime
- No full native rebuild of the Paperclip surfaces yet

## Success Criteria

The launch user should be able to answer these three questions without confusion:

- "What does my company do?"
- "What should I connect first?"
- "What should I launch first?"

If the interface makes those answers obvious, the launch surfaces are working.
