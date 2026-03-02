-- 1️⃣ Adiciona coluna temporariamente nullable
ALTER TABLE "TimelineEvent"
ADD COLUMN "orgId" TEXT;

-- 2️⃣ Backfill usando relação com Person
UPDATE "TimelineEvent" t
SET "orgId" = p."orgId"
FROM "Person" p
WHERE t."personId" = p."id";

-- 3️⃣ Garante que não ficou NULL
ALTER TABLE "TimelineEvent"
ALTER COLUMN "orgId" SET NOT NULL;

-- 4️⃣ Cria foreign key
ALTER TABLE "TimelineEvent"
ADD CONSTRAINT "TimelineEvent_orgId_fkey"
FOREIGN KEY ("orgId") REFERENCES "Organization"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- 5️⃣ Índices estratégicos
CREATE INDEX "TimelineEvent_orgId_createdAt_idx"
ON "TimelineEvent"("orgId", "createdAt");

CREATE INDEX "TimelineEvent_orgId_action_createdAt_idx"
ON "TimelineEvent"("orgId", "action", "createdAt");

