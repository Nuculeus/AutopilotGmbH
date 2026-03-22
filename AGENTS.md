# Working agreements

- Do not change architecture or introduce new dependencies unless the ticket explicitly allows it.
- Work on one ticket only.
- Start by reading the existing relevant files and summarizing the plan.
- Prefer minimal, high-confidence changes over broad rewrites.
- Preserve existing routes and public UX unless the ticket says otherwise.
- Add or update tests for every behavior change.
- Run the relevant test suite after changes.
- Never touch billing, credits, provisioning, or webhook code without explicit acceptance criteria in the prompt.
- If a task is ambiguous, stop and list assumptions instead of inventing a solution.
- Output a short changelog: files changed, why, risks, and how to verify.
