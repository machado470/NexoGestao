/*
  Warnings:

  - A unique constraint covering the columns `[slug,version]` on the table `Track` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `type` to the `PersonException` table without a default value. This is not possible if the table is not empty.
  - Made the column `reason` on table `PersonException` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "ExceptionType" AS ENUM ('VACATION', 'LEAVE', 'PAUSE');

-- CreateEnum
CREATE TYPE "TrackStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "TrackItemType" AS ENUM ('READING', 'ACTION', 'CHECKPOINT');

-- DropIndex
DROP INDEX "Track_slug_key";

-- AlterTable
ALTER TABLE "PersonException" ADD COLUMN     "processedAt" TIMESTAMP(3),
ADD COLUMN     "type" "ExceptionType" NOT NULL,
ALTER COLUMN "reason" SET NOT NULL;

-- AlterTable
ALTER TABLE "Track" ADD COLUMN     "status" "TrackStatus" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "TrackItem" (
    "id" TEXT NOT NULL,
    "trackId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT,
    "type" "TrackItemType" NOT NULL,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrackItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrackItemCompletion" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrackItemCompletion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TrackItem_trackId_order_key" ON "TrackItem"("trackId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "TrackItemCompletion_itemId_personId_key" ON "TrackItemCompletion"("itemId", "personId");

-- CreateIndex
CREATE INDEX "PersonException_personId_startsAt_endsAt_idx" ON "PersonException"("personId", "startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "PersonException_endsAt_processedAt_idx" ON "PersonException"("endsAt", "processedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Track_slug_version_key" ON "Track"("slug", "version");

-- AddForeignKey
ALTER TABLE "TrackItem" ADD CONSTRAINT "TrackItem_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "Track"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackItemCompletion" ADD CONSTRAINT "TrackItemCompletion_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "TrackItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackItemCompletion" ADD CONSTRAINT "TrackItemCompletion_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackItemCompletion" ADD CONSTRAINT "TrackItemCompletion_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
