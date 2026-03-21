# Chat Workspace Bridge Design

## Goal

Turn `/app/chat` into a real launch-grade operational workspace for `AutopilotGmbH` by reusing the Paperclip chat surface behind the wrapper's authenticated shell and company bridge, while preserving a clean path toward a future fully native German chat UI.

## Product Decision

For launch, `/app/chat` should stop behaving like a placeholder and become a real product surface.

The chosen launch model is:

- `wrapper/` keeps ownership of identity, billing, credits, provisioning, and customer-facing navigation.
- `paperclip/` provides the real chat workspace experience behind the scenes.
- the wrapper exposes that workspace through a controlled server-side bridge, not through direct Paperclip login and not through open query-param tenancy.

This follows the already approved hybrid launch architecture:

- launch fast with controlled Paperclip reuse
- replace reused surfaces later with more native German wrapper experiences

## Why This Is The Right Move

The current `/app/chat` route already looks like a product entry point, so a placeholder there creates a trust break. A user who signs in, provisions a company, and lands on "Chat" expects to work immediately.

A real bridged workspace solves the immediate product problem:

- users get a functioning operational center now
- the launch product feels real instead of aspirational
- engineering effort stays aligned with speed-to-market

At the same time, this should not become a permanent architectural shortcut. The bridged chat route is a launch accelerator, not the final UI model.

## Route Model

### Public Route

The public customer route remains:

- `/app/chat`

This route belongs to the wrapper and should remain stable even if the internal workspace delivery mechanism changes later.

### Internal Delivery Shape

`/app/chat` becomes a workspace host route with a controlled Paperclip proxy behind it.

The wrapper should:

1. verify the Clerk session
2. load the user's mapped company and provisioning state
3. verify the user can open the workspace
4. forward only allowed Paperclip workspace routes for that mapped company
5. present the result under the wrapper-controlled product URL

## Proxy Scope

The bridge for `/app/chat` should be intentionally narrow.

### Allowed For Launch

Open only the minimal Paperclip surface required for the chat workspace to function:

- the chat workspace HTML entry route
- the JS/CSS/font/static assets needed by that route
- the minimal API endpoints used by the chat workspace
- live update or event endpoints only if the chat route actually depends on them

### Explicitly Not Allowed

Do not expose the entire Paperclip product.

The following remain wrapper-owned or unavailable through this route:

- sign-in or sign-up flows
- billing, plan management, and credits
- provisioning flows
- arbitrary instance or admin routes
- unrestricted company switching
- routes unrelated to the launch chat experience

The proxy must fail closed for any path outside the allowlist.

## Identity And Authorization

The security boundary remains the same as the rest of the launch architecture.

### Source Of Truth

`wrapper/` remains the source of truth for:

- authenticated user identity
- company mapping
- launch credits and paid plan state
- provisioning lifecycle state

### Paperclip Principal

The workspace bridge must continue using a stable Paperclip-recognized principal derived from Clerk identity:

- `clerk:<userId>`

This principal must already be the owner or authorized member of the mapped company from provisioning time.

### Non-Goals

The system must not:

- trust `companyId` from the browser
- allow customer logins directly into Paperclip
- use a shared fake admin actor for workspace access

## UX Model

The launch chat should feel like real product, not an embedded demo.

### Wrapper Responsibilities Around The Workspace

The wrapper may still provide:

- stable product URL and routing
- auth and account controls
- high-level company context
- fallback error and recovery states

### Wrapper Chrome During Chat

The chat route should use reduced wrapper chrome so the workspace has room to breathe. The navigation can remain wrapper-owned, but the central experience should prioritize the real working surface.

This means:

- keep the URL and shell under `autopilotgmbh.de`
- reduce decorative wrapper content on `/app/chat`
- emphasize the actual work area over placeholder cards

## Failure States

The route must degrade cleanly.

### Before Workspace Access

If provisioning is not active or workspace access is not ready:

- keep the user in wrapper-owned launch flows
- show a blocking state with the next correct action

### Missing Mapping

If the wrapper cannot resolve a company mapping:

- return a closed failure state
- never attempt a broad upstream proxy

### Upstream Workspace Failure

If the proxied Paperclip workspace fails:

- return a wrapper-framed error surface
- show a retry path
- preserve support/debug metadata server-side

## Testing Strategy

The change should be proven through:

- unit tests for route allowlisting
- unit tests for workspace gate decisions
- integration tests for proxy authorization using the mapped `clerk:<userId>` principal
- smoke tests that `/app/chat` returns a real workspace surface after provisioning
- regression tests that unauthorized or unrelated Paperclip paths remain blocked

## Rollout Plan

### Phase 1

Replace the `/app/chat` placeholder with a real bridged Paperclip workspace surface.

### Phase 2

Use the same pattern selectively for other launch-critical operational surfaces if needed.

### Phase 3

Replace the bridged chat route with a more native German wrapper chat as the product matures.

The important point is that the public route remains stable while the internal implementation evolves.

## Constraints

- the current wrapper bridge only exposes narrow JSON endpoints such as dashboard summary and secrets
- the Paperclip chat surface may require HTML, assets, client-side routing, and additional API endpoints
- launch speed matters more than perfect long-term UI purity
- security and tenancy still matter more than speed hacks

## Decision

The confirmed implementation direction is:

- keep `/app/chat` as a wrapper-owned route
- replace the placeholder with a real Paperclip-backed workspace host
- use a narrow, allowlisted, identity-translating server-side bridge
- preserve a later migration path to a fully native German wrapper chat
