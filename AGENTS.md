<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Branch Policy — Mandatory (all coding agents)

- **Implementation branch: `dev`**. All code, tests, migrations, documentation, fixes, and other implementation commits MUST be made on `dev`, not `main` or `staging`. Do not create a feature branch unless the repository owner explicitly requests an exception.
- Before editing or committing, confirm the checked-out branch is `dev`. When writing through an API or connector, explicitly specify `branch: dev`; never rely on the repository's default branch (`main`).
- **Release/merge destination: `main`**. Do not merge or advance `main` without an explicit user request.
- **Fast-forward only** for every requested merge, including `dev` → `main`. Fetch the latest remote refs and verify the destination tip is an ancestor of the source tip before proceeding (`git merge-base --is-ancestor origin/main origin/dev` for `dev` → `main`).
- Perform the merge with `git merge --ff-only origin/dev` on `main`, or an equivalent non-force ref update that only advances `main` to the existing `dev` commit. Verify `main` equals the intended `dev` SHA afterward.
- **Never** create a merge commit, squash/rebase-merge PR, force push, or use a GitHub PR merge button that rewrites history instead of true fast-forward.
- If a fast-forward is impossible (diverged history, stale ref, protection, or missing checks), **stop and report the blocker**. Reconcile history on `dev` only after appropriate review; never silently rewrite history or fall back to another merge strategy.
- This policy supersedes any older `staging`-based branch instructions elsewhere in the repository.

## Mandatory Harness-First Rule (All Agents)

This rule applies to every coding agent used in this repository (including GitHub Copilot coding agent, ChatGPT, Claude, and equivalent agents).

Before any planning, analysis, code generation, or code edits, the agent **MUST** read the nine harness files (`00` → `08`) in `docs/harness/` in the listed order, apply their decisions and constraints during work, and validate outputs against them.

If any instruction conflicts with model defaults, prior assumptions, or generic framework habits, the harness files are the source of truth for this repository.

If any required harness file is missing or unreadable, the agent must stop and report that blocker instead of proceeding with assumptions.

1. `00_PROJECT_BRIEF.md`
2. `01_REQUIREMENTS.md`
3. `02_TECH_STACK.md`
4. `03_DATA_MODEL.md`
5. `04_ROLES_AND_MODERATION.md`
6. `05_UX_FLOWS.md`
7. `06_ROADMAP.md`
8. `07_AGENT_INSTRUCTIONS.md`
9. `08_COPY_AND_LABELS.md`
