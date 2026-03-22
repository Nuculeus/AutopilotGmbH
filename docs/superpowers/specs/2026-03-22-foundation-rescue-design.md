# Foundation Rescue Design

**Goal:** Turn the current wrapper-first prototype into a truthful, production-safe control plane without widening scope.

## Why this design exists

The current repository already contains the right launch ingredients:

- guided onboarding
- a German wrapper shell
- a Paperclip bridge
- LLM readiness checks
- credits, billing, and provisioning surfaces
- early revenue milestone concepts

But it is still a prototype control layer, not a durable product platform. The immediate job is not to add more features. The immediate job is to stabilize the foundation, move business state toward Postgres, and ship one reliable end-to-end revenue path.

## Product decision

AutopilotGmbH is not being built as a generic AI playground or a broad "entire company runtime" claim.

The working product definition is:

> AutopilotGmbH is the German-language revenue operating system that guides ambitious builders from idea to first verified revenue, starting with one reliable Service Engine path.

## Non-negotiables

- Public promise is **guided autonomy**, not unsupervised autonomy.
- **Service Engine first** is the primary wedge.
- `Postgres` becomes the source of truth for business state.
- `Clerk` remains auth and lightweight entitlement mirror only.
- Every costly or irreversible action must become a durable run.
- Billing, credits, provisioning, and webhooks are high-risk surfaces and must not be changed casually.
- The product must become more truthful and reliable before it becomes broader.

## Current reality

The wrapper already owns:

- public landing and auth flow
- start and onboarding surfaces
- dashboard and app shell
- Paperclip bridge and workspace embedding
- early billing and credit surfaces

The risky gap is that too much business-critical logic still lives in transitional or metadata-heavy flow logic, while durable domain persistence, run orchestration, and immutable ledgers are not fully in place yet.

## Target architecture

Keep the current wrapper-first shape and existing public routes where possible.

Refactor toward:

- `wrapper/` as the only public app
- `paperclip/` as private execution core
- `Postgres` as durable product state
- worker-driven run orchestration
- immutable billing and credit ledger
- typed Paperclip integration with guardrails

## Core data direction

The first durable domain model needs to support:

- `workspace`
- `venture`
- `venture_spec`
- `connector_binding`
- `run`
- `run_step`
- `approval_gate`
- `artifact`
- `experiment`
- `experiment_variant`
- `metric_event`
- `credit_ledger`
- `usage_event`
- `billing_account`

The first release may still expose only one active venture in the UI, but the data model should not paint the product into a single-venture corner.

## Pricing and trust direction

External packaging should be outcome-first:

- named sprints
- named deliverables
- visible estimate and max cost
- clear retry and refund behavior

Internal accounting should remain:

- credit-ledger based for user balance
- usage-event based for infrastructure cost

This avoids customer-facing "credit fog" while preserving operational cost control.

## Reliability direction

Every meaningful action should become a durable run with:

- stable id
- explicit status
- timestamps
- actor
- budget cap
- log traceability
- retry policy

The wrapper should show:

- what is running
- what failed
- whether retry is safe
- whether a user was charged
- when approval is required

## Phased roadmap

### Phase 0: Stabilize

- freeze feature drift
- make production claims truthful
- add observability
- make provisioning idempotent
- replace generic failure states with retry-safe UX
- rewrite `/start` from credits-first to outcome-first

### Phase 1: Foundation

- install DB package and repositories
- move state toward Postgres
- add worker and durable run engine
- implement immutable ledger
- add typed integration boundaries

### Phase 2: Service Engine first

- define offer
- connect essentials
- create first offer asset
- activate checkout
- record first verified revenue

### Phase 3+: Widen only after stability

- Content Engine
- Experiment layer
- broader templates
- stronger team and portfolio features

## Anti-goals during the rescue phase

- no marketplace explosion
- no autonomy overclaim
- no unlimited heavy infrastructure bundles
- no deeper business-state dependency on Clerk metadata
- no broad feature wave before foundation work is complete

## Success condition

The rescue phase succeeds when the repository stops behaving like a fast-moving prototype and starts behaving like a controlled product platform:

- truthful README and docs
- stable guarded scope
- DB-backed product state
- idempotent provisioning
- durable runs
- immutable billing records
- one complete Service Engine path to first verified revenue
