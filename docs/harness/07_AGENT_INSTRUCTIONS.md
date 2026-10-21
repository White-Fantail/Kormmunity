# Agent Instructions

## Project Goal
Build a Korean-language, Kakao-friendly community market board for Korean residents in New Zealand.

## Important Product Decisions
- The app should feel closer to a chat/community board than a formal classified ads site.
- Post title is optional.
- Body, category, and city are required.
- Categories and cities should be stored in DB and seeded.
- Sale posts need price and sold status.
- Images must be uploaded to an external image hosting/storage service, not stored directly in DB.
- Kakao login is the primary authentication method.
- Direct Kakao message sending may not be available in MVP. Prefer user-provided Kakao Open Chat/contact URL.
- The UI language should be Korean first.
- Internal code names, routes, types, enums, and DB schema should use English.

## Required Roles
- USER
- COORDINATOR
- ADMIN

## Moderation Rules
- Coordinators can hold posts and comments.
- Coordinators can request review for problematic users.
- Admins make final user restriction/deletion decisions.
- Every moderation action must be logged.

## Branch Policy (Mandatory)

- **Work directly on `dev`** for all implementation, bug fixes, tests, migrations, and documentation. Never write to `main` or `staging` during development; explicitly target `dev` in GitHub API/connector calls (default branch is `main`).
- `main` is updated only when the user explicitly asks to merge. The normal source is `dev` and destination is `main`; no automatic release.
- **Use real fast-forward merges only.** Fetch current refs, make sure destination HEAD is an ancestor of source HEAD (e.g. `git merge-base --is-ancestor origin/main origin/dev`), and then advance the destination ref without creating new commits (`git merge --ff-only origin/dev` on `main`, or a non-force equivalent ref update).
- Verify the resulting destination commit SHA is identical to the approved source commit SHA.
- Do not use merge commits, squash merge, GitHub rebase merge, force push, or any fallback merge method. If the branches diverge or the update is blocked, stop, explain the blocker, and resolve safely on `dev` before retrying.
- Do not open a PR targeting the obsolete `staging` branch. If a PR is explicitly requested, target `main` from `dev` for review, but do not use the PR merge action unless it can preserve the exact fast-forward semantics; otherwise advance the ref with the approved fast-forward procedure.
- This rule takes precedence over legacy documentation mentioning the former `staging` policy.

## Development Style
- Implement incrementally by phase.
- Keep DB schema explicit and migration-safe.
- Prefer simple, production-ready MVP over over-engineered features.
- Add README updates whenever major functionality is implemented.
- Add clear TODO comments for Kakao messaging limitations and image provider choices.

## Suggested Route Structure

```txt
/
/login
/posts
/posts/new
/posts/[postId]
/my/posts
/my/profile
/admin
/admin/users
/admin/posts
/admin/categories
/admin/cities
/coordinator
/coordinator/posts
/coordinator/reports
```

## Suggested Component Structure

```txt
app/
  posts/
  my/
  admin/
  coordinator/
components/
  posts/
  comments/
  filters/
  auth/
  moderation/
lib/
  auth/
  db/
  kakao/
  upload/
  permissions/
  moderation/
prisma/
  schema.prisma
  seed.ts
```

## Permission Helper Requirement
Create helper functions such as:

```ts
canCreatePost(user)
canEditPost(user, post)
canDeletePost(user, post)
canHoldPost(user)
canRestorePost(user)
canModerateUser(user)
canMakeFinalUserDecision(user)
```
