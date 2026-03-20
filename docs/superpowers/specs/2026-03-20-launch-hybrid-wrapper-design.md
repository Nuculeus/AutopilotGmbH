# Launch Hybrid Wrapper Design

## Goal

Ship a fast DACH-focused launch version of `AutopilotGmbH` that feels like a polished local alternative to `app.usenaive.ai`, while keeping `paperclip` behind the scenes as the execution core and preserving a clean path toward more native wrapper screens over the next few weeks.

## Architecture

### Product Boundary

The launch product uses a hybrid split:

- `wrapper/` is the only customer-facing application.
- `paperclip/` runs as an internal orchestration and execution service.
- Launch-critical SaaS flows stay native in the wrapper.
- High-value operational surfaces are temporarily reused from Paperclip behind a controlled server-side bridge.

This keeps time-to-market high without turning the whole product into a fragile full-proxy shell.

### Native Wrapper Surfaces

The following areas remain fully native in `wrapper/` for launch:

- landing and marketing
- Clerk auth
- pricing and launch credits
- Stripe checkout and billing state
- onboarding and "Firma starten"
- company provisioning status
- customer-visible plan, credit, and DSGVO messaging

These areas define identity, money, consent, and trust, so they should not depend on Paperclip UI assumptions.

### Reused Paperclip Surfaces

For launch, the wrapper may proxy or embed selected Paperclip-backed product areas behind authenticated wrapper routes:

- chat
- artifacts and active tasks
- company HQ
- apps
- connections

These reused surfaces are temporary accelerators. They should be wrapped in Autopilot branding, German copy where feasible, and a route structure controlled by the wrapper.

### Identity Model

`wrapper/` remains the single source of truth for customer identity via Clerk.

Paperclip authentication is treated as internal infrastructure auth, not customer auth. Customers should not sign into Paperclip directly, use bootstrap invites, or interact with the internal Better Auth flows.

The wrapper owns a durable mapping:

- `clerkUserId`
- `paperclipCompanyId`
- plan and credit metadata
- provisioning lifecycle state

### Access Bridge

The wrapper must not rely on `companyId` query parameters for isolation. Paperclip authorization is based on actor identity and database-backed memberships, not URL state.

Launch access should therefore use a server-side bridge that does all of the following:

- resolves the signed-in Clerk user
- loads the user-to-company mapping
- establishes or uses a Paperclip-recognized authenticated actor for that company
- forwards only the allowed Paperclip surface for that mapped company

The bridge can start as a controlled internal proxy, but the security boundary is identity translation plus membership, not frontend rewrites.

## Provisioning Flow

### Signup To First Company

1. User signs in through Clerk.
2. User claims launch credits or chooses a paid plan.
3. User starts company creation from the wrapper.
4. Wrapper calls an internal provisioning route.
5. Provisioning route creates the Paperclip company through an admin-capable internal path.
6. Provisioning route records the `clerkUserId -> paperclipCompanyId` mapping plus status metadata.
7. Provisioning route bootstraps company defaults, including German prompts and skill references.
8. Wrapper redirects the user into the launch dashboard shell.

### Provisioning Constraints

Provisioning must be idempotent:

- repeated requests must not create duplicate companies
- billing retries must not duplicate setup
- partial failures must leave visible status for retry or support recovery

### Skill Injection

The launch company bootstrap should attach the repository-owned operating layer:

- [SKILLS.md](/Users/aibase/Documents/AI%20Comp/WRAP/.worktrees/codex-wrapper-foundation/SKILLS.md)
- [custom-skills/](/Users/aibase/Documents/AI%20Comp/WRAP/.worktrees/codex-wrapper-foundation/custom-skills)
- [.claude/skills/](/Users/aibase/Documents/AI%20Comp/WRAP/.worktrees/codex-wrapper-foundation/.claude/skills)
- [.agents/skills/](/Users/aibase/Documents/AI%20Comp/WRAP/.worktrees/codex-wrapper-foundation/.agents/skills)

This keeps the DACH and DSGVO behavior portable and auditable outside of the Paperclip core.

## Launch Dashboard Shape

The launch dashboard should feel like a localized, branded cousin of `app.usenaive.ai`, but sharper and more opinionated for DACH users.

The wrapper should provide the surrounding shell and customer-state panels:

- navigation
- company status
- credit balance
- trial or subscription state
- onboarding checklist
- launch banners and support messaging

Inside that shell, launch can temporarily reuse Paperclip-powered surfaces for the operational center.

## Rollout Strategy

### Phase 1: Launch Fast

Build the native wrapper shell plus the access bridge and reuse the selected Paperclip surfaces.

### Phase 2: Replace High-Trust Surfaces

Replace the most customer-sensitive reused surfaces first:

- dashboard overview
- company HQ
- connections

### Phase 3: Replace Core Work Surfaces

Replace or deeply customize:

- chat
- task and artifact views
- app deployment flows

This phased model lets launch happen now without locking the product into long-term UI debt.

## Error Handling

- Provisioning states should be explicit: `pending`, `active`, `failed`, `suspended`.
- Dashboard access should block gracefully if provisioning is incomplete.
- Proxy or embedded Paperclip areas must fail closed when the wrapper-to-company mapping is missing.
- Billing success must not imply company availability until provisioning completes.
- Support should have enough metadata to replay or repair failed company setup.

## Testing Strategy

- unit tests for company mapping, credit gating, and provisioning state transitions
- integration tests for signup to company creation flow
- integration tests for access bridge authorization behavior
- smoke tests for proxy or embedded Paperclip launch routes
- regression tests ensuring users cannot access a company other than their mapped company

## Open Questions And Constraints

- Paperclip company creation currently requires instance-admin or local-trusted access, so launch needs an internal admin-capable provisioning path.
- The exact launch bridge mechanism still needs a final technical choice between controlled reverse proxying, server-fetched embedded views, or a tighter backend facade.
- Paperclip branding and English-heavy UI text will need selective override or wrapper framing on reused launch screens.
- `autoresearch` remains checked out but is not runnable on the current macOS ARM host due to CUDA-pinned dependencies.
