CREATE TABLE "AgentRequest" (
  "id" TEXT NOT NULL,
  "agentKeyId" TEXT NOT NULL,
  "operation" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "requestHash" TEXT NOT NULL,
  "externalReferenceId" TEXT,
  "postId" TEXT,
  "commentId" TEXT,
  "response" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AgentRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AgentRequest_agentKeyId_operation_idempotencyKey_key"
  ON "AgentRequest"("agentKeyId", "operation", "idempotencyKey");

CREATE UNIQUE INDEX "AgentRequest_agentKeyId_operation_externalReferenceId_key"
  ON "AgentRequest"("agentKeyId", "operation", "externalReferenceId")
  WHERE "externalReferenceId" IS NOT NULL;

CREATE INDEX "AgentRequest_postId_createdAt_idx"
  ON "AgentRequest"("postId", "createdAt");

CREATE INDEX "AgentRequest_commentId_createdAt_idx"
  ON "AgentRequest"("commentId", "createdAt");

ALTER TABLE "AgentRequest"
  ADD CONSTRAINT "AgentRequest_postId_fkey"
  FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AgentRequest"
  ADD CONSTRAINT "AgentRequest_commentId_fkey"
  FOREIGN KEY ("commentId") REFERENCES "Comment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
