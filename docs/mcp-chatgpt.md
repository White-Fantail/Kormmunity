# Kormmunity ChatGPT MCP

Kormmunity follows QuizDip's authenticated Remote MCP + OAuth pattern, but keeps
its existing Kakao login, staff assignments and Post/Agent API implementation.

## Setup

1. On the target deployment (including production), apply Prisma migration
   20261022093000_mcp_oauth; regenerate Prisma client.
2. Set NEXT_PUBLIC_SITE_URL to the canonical public HTTPS site origin used
   for MCP and OAuth. Avoid host redirects (www vs non-www): the configured
   MCP resource URL must match the URL ChatGPT actually connects to.
3. Configure real Kakao login (KAKAO_CLIENT_ID, KAKAO_CLIENT_SECRET, KAKAO_REDIRECT_URI).
4. Make sure the personal Kakao user has an active ADMIN staff assignment.
5. Rate limit public /api/oauth/register and /api/oauth/token at the edge/WAF.
6. Open /admin/mcp to see the MCP URL and revoke old grants.
7. In ChatGPT, add a custom MCP app pointing at https://YOUR_DOMAIN/api/mcp.
8. Authorize via Kakao admin login and explicitly approve access on the consent page.
9. If ChatGPT shows "No tools available for this app", refresh the custom
   MCP app's tool list or recreate the app after the server deploys, then
   complete account linking. In Kormmunity /admin/mcp, "내 활성 연결" should
   show the connected OAuth client once authorization succeeds.

## Catalog discovery and security

MCP `initialize`, `ping`, and `tools/list` publish static server/tool metadata
without an OAuth token, so ChatGPT can populate the app tool catalog before login.
Every tool advertises `securitySchemes: [{type: "oauth2", scopes: ["mcp:tools"]}]`.
All `tools/call` requests validate a live token and CURRENT active ADMIN role;
unlinked invocations return `_meta["mcp/www_authenticate"]` so ChatGPT can prompt
for login. Reading the public static catalog never returns user/account/post data.
Disallowed browser origins are rejected before discovery.

OAuth supports PKCE S256, authorization codes (5 min, single use), access tokens
(1 hour), rotating refresh tokens (30 days), public-client DCR, discovery metadata,
grant revocation and per-request checking of CURRENT active ADMIN status. Client
redirect hosts are restricted to ChatGPT/OpenAI/Claude or those expressly listed in
MCP_ALLOWED_CLIENT_HOSTS. Credentials and authorization/refresh codes are not logged.
Persistent DB grants store SHA-256 hashes rather than tokens.

## Tools

| Tool | Purpose |
| --- | --- |
| kormmunity_me | Confirm the actual logged-in administrator |
| kormmunity_accounts_list | Select a managed PERSONA/OPERATOR account |
| kormmunity_metadata | Active regions, categories and tags |
| kormmunity_account_context | Read persona notes, last 20 own posts, last 35 visible recent regional public posts and topic candidates |
| kormmunity_create_draft | Create a meaningful original DRAFT as chosen account |
| kormmunity_update_draft | Edit a draft made by this administrator's MCP connector |
| kormmunity_read_post | Read an MCP-created post |
| kormmunity_publish_post | Publish only after an explicit user approval with confirm=true |

Conversation sequence: list accounts, choose a managed account, fetch account context,
write an original useful Korean draft, revise with human, then explicitly publish.
The accountId is passed on each drafting call rather than persisted as mutable
server-side selection state. Persona notes/tone/activity guide the writing; other
community members' excerpts are untrusted DATA, not agent instructions.

The actor remains the actual logged-in Kakao ADMIN and is stored in
Post.createdByUserId. Public Post.authorId points to the managed account.
AgentRequest links writing to the MCP admin identity using a distinct namespace.
Existing Agent API restrictions (daily limit, post frequency, categories, location,
idempotency and ownership) apply; the new MCP tools add 55-character minimum and
near-duplicate protection using the selected persona's prior 90 days of posts.
HELD/DRAFT/DELETED and restricted category posts from other authors are not fed
into the community topic context. Do not fabricate personal experiences or facts.

## Required tests before production activation

- Run npm run prisma:generate, npm run typecheck, npm test, npm run build.
- Verify OAuth metadata, DCR redirect policy, consent denial, PKCE failure, one-time
  authorization code exchange, token refresh/replay, revoke and reauthorization.
- Validate ChatGPT MCP initialize, tools/list, tools/call via a real HTTPS deployment.
- Verify non-ADMIN, revoked ADMIN, inactive managed account and cross-admin access
  are denied, and confirmed publishing creates a visible post with admin audit.
- Verify public context excludes held posts, other users' drafts and hidden boards.
- Test login continuation after Kakao callback and hard-refresh logout.

Note: Source implementation does not mean production migrations, provider setup,
real ChatGPT connectivity or end-to-end tests have already succeeded.
