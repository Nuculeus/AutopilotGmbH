# AutopilotGmbH

DSGVO-first SaaS wrapper around Paperclip with a dedicated Next.js frontend, German agent skills, and a deployment layout aimed at low-cost EU hosting.

## Structure

- `paperclip/` is a git submodule pointing at your Paperclip fork and remains the orchestration backend.
- `wrapper/` contains the customer-facing Next.js SaaS layer with Clerk and Stripe dependencies installed.
- `custom-skills/` contains reusable organization-specific skills such as Gstack, Autoresearch, and German-language prompts.
- `.claude/skills/` contains Paperclip-specific skill links or files for Claude-compatible tooling.
- `.agents/skills/` contains shared skills for general agents.
- `SKILLS.md` contains the top-level operating prompt and policy layer.
- `docker-compose.prod.yml` provides the production-oriented compose contract for Paperclip, Postgres, and the wrapper.
- `.env.example` lists the environment variables required to run the stack.

## Quick Start

1. Copy `.env.example` to `.env` and fill in your secrets.
2. Initialize submodules with `git submodule update --init --recursive`.
3. Run `./setup` inside `.claude/skills/gstack` to build its local tooling and refresh the linked skills.
4. Run `uv sync` inside `custom-skills/autoresearch` on a compatible Linux/CUDA environment.
5. Configure the checked-out `paperclip/` backend for your environment.
6. Work inside `wrapper/` for the SaaS frontend.
7. Start the stack with `docker compose -f docker-compose.prod.yml up`.

## Notes

- `paperclip/` is now tracked as a submodule so the root repository records the exact backend revision.
- `.claude/skills/gstack` and `custom-skills/autoresearch` are tracked as submodules as well.
- `SKILLS.md` now contains the active German-language master prompt and DSGVO policy layer.
- `wrapper/` was scaffolded with `create-next-app` and already includes `@clerk/nextjs`, `stripe`, `@stripe/stripe-js`, and `lucide-react`.
- `custom-skills/autoresearch` currently targets CUDA-enabled Linux for full execution. On macOS ARM it will not fully resolve with the pinned PyTorch build.
