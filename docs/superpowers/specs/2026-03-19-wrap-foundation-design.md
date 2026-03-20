# WRAP Foundation Design

## Goal

Build a DSGVO-first SaaS wrapper around Paperclip that can provision isolated companies, monetize access with Stripe, and preserve German-language operations through injected skills and prompts.

## Architecture

### Core Backend

`paperclip/` is the orchestration core and remains the operational backend. It runs as a shared Node.js + React UI instance with built-in company isolation. Instead of embedded storage, it connects to an external Postgres instance so the deployment can use managed or containerized databases with clearer operational boundaries.

### Frontend Layer

`frontend/` becomes a Next.js 15 App Router application that handles:

- marketing and landing pages
- user authentication via Clerk with EU hosting
- Stripe billing and customer lifecycle
- the "Firma starten" flow that provisions a Paperclip company and redirects the user into the Paperclip dashboard

The frontend is the public product surface; Paperclip stays the execution plane.

### Identity And Billing

Clerk is the source of truth for authenticated users. Stripe is the source of truth for billing state. The frontend maps authenticated, paid users to a provisioned Paperclip company and stores that mapping in Postgres.

### Isolation

Isolation is handled in two layers:

- Paperclip's native company scope for application-level boundaries
- Postgres row-level security for database-level boundaries

This is the minimum shape needed to stay scale-ready while preserving a shared-instance cost profile.

### Compliance Layer

German prompts, Gstack workflows, Autoresearch guidance, and DSGVO constraints are kept outside the Paperclip core and injected at runtime from this repository:

- [SKILLS.md](/Users/aibase/Documents/AI%20Comp/WRAP/SKILLS.md)
- [custom-skills/](/Users/aibase/Documents/AI%20Comp/WRAP/custom-skills)
- [.claude/skills/](/Users/aibase/Documents/AI%20Comp/WRAP/.claude/skills)
- [.agents/skills/](/Users/aibase/Documents/AI%20Comp/WRAP/.agents/skills)

This keeps the customization layer portable and easier to audit.

### Hosting

Initial deployment target is Docker Compose on an EU host such as Hetzner Cloud, Fly.io EU, or Railway, optimized for low-cost early-stage operation. The stack should remain portable enough to move to managed infrastructure later without reworking the app boundaries.

## Data Flow

1. A visitor lands on the Next.js frontend.
2. The user signs up or signs in through Clerk.
3. The user purchases or activates a plan through Stripe.
4. The frontend provisions a new Paperclip company scoped to that customer.
5. The frontend stores company-to-user and billing metadata in Postgres.
6. The user is redirected into the Paperclip dashboard for their provisioned company.
7. Runtime-injected skills and German prompts shape how agents behave inside that company context.

## Error Handling

- Company provisioning must be idempotent so retries do not create duplicate companies.
- Billing and provisioning should use explicit status transitions such as `pending`, `active`, `failed`, and `suspended`.
- Redirect into Paperclip should happen only after company creation and access mapping succeed.
- Failures in Stripe webhook handling or company provisioning must surface in an internal admin view or audit log.

## Testing Strategy

- Unit tests for provisioning, billing-state mapping, and runtime skill resolution
- Integration tests for signup to provisioning handoff
- Webhook tests for Stripe event handling
- Access-control tests for company scoping and RLS behavior
- Smoke tests for Docker Compose boot and service-to-service connectivity

## Open Constraints

- `autoresearch` is checked out but not runnable on the current macOS ARM host due to CUDA-specific PyTorch dependencies.
- The Paperclip integration contract for company provisioning needs to be discovered from the checked-out backend before implementation.
- Runtime prompt injection needs an explicit mechanism in either the Paperclip server, bootstrap scripts, or frontend provisioning flow.
