-- CreateTable
CREATE TABLE "QueueJob" (
    "id" TEXT NOT NULL,
    "queue" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "QueueJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "QueueJob_queue_status_createdAt_idx" ON "QueueJob"("queue", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "QueueJob_queue_jobId_key" ON "QueueJob"("queue", "jobId");
