CREATE TABLE "McpOAuthClient" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "redirectUris" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "McpOAuthCode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "codeHash" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "redirectUri" TEXT NOT NULL,
    "codeChallenge" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "McpOAuthCode_codeHash_key" ON "McpOAuthCode"("codeHash");
CREATE INDEX "McpOAuthCode_expiresAt_idx" ON "McpOAuthCode"("expiresAt");

CREATE TABLE "McpOAuthToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accessHash" TEXT NOT NULL,
    "refreshHash" TEXT,
    "clientId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "refreshExpiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "McpOAuthToken_accessHash_key" ON "McpOAuthToken"("accessHash");
CREATE UNIQUE INDEX "McpOAuthToken_refreshHash_key" ON "McpOAuthToken"("refreshHash");
CREATE INDEX "McpOAuthToken_userId_revokedAt_idx" ON "McpOAuthToken"("userId", "revokedAt");
CREATE INDEX "McpOAuthToken_refreshExpiresAt_idx" ON "McpOAuthToken"("refreshExpiresAt");
