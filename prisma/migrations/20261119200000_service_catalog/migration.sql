-- CreateTable
CREATE TABLE "CatalogService" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "entryKey" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "priceCents" INTEGER,
    "currency" TEXT NOT NULL,
    "durationMinutes" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CatalogService_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CatalogServiceRevision" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "reason" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "actorName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CatalogServiceRevision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CatalogService_orgId_active_name_id_idx" ON "CatalogService"("orgId", "active", "name", "id");

-- CreateIndex
CREATE UNIQUE INDEX "CatalogService_id_orgId_key" ON "CatalogService"("id", "orgId");

-- CreateIndex
CREATE UNIQUE INDEX "CatalogService_orgId_entryKey_key" ON "CatalogService"("orgId", "entryKey");

-- CreateIndex
CREATE UNIQUE INDEX "CatalogService_orgId_code_key" ON "CatalogService"("orgId", "code");

-- CreateIndex
CREATE INDEX "CatalogServiceRevision_orgId_serviceId_version_idx" ON "CatalogServiceRevision"("orgId", "serviceId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "CatalogServiceRevision_serviceId_version_key" ON "CatalogServiceRevision"("serviceId", "version");

-- AddForeignKey
ALTER TABLE "CatalogService" ADD CONSTRAINT "CatalogService_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogServiceRevision" ADD CONSTRAINT "CatalogServiceRevision_serviceId_orgId_fkey" FOREIGN KEY ("serviceId", "orgId") REFERENCES "CatalogService"("id", "orgId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CatalogService" ADD CONSTRAINT "CatalogService_values" CHECK (
 "code" ~ '^[A-Z0-9][A-Z0-9._-]{0,39}$' AND length(trim("name")) BETWEEN 2 AND 140
 AND length("description") <= 2000 AND "currency" ~ '^[A-Z]{3}$'
 AND ("priceCents" IS NULL OR "priceCents" >= 0)
 AND ("durationMinutes" IS NULL OR "durationMinutes" BETWEEN 1 AND 10080)
 AND "version" >= 0
);
ALTER TABLE "CatalogServiceRevision" ADD CONSTRAINT "CatalogServiceRevision_values" CHECK ("version" >= 0 AND length(trim("reason")) BETWEEN 10 AND 1000);
