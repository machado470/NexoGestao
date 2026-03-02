/*
  Warnings:

  - The `status` column on the `CorrectiveAction` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `type` on the `PersonException` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `Track` table. All the data in the column will be lost.
  - Added the required column `severity` to the `Event` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "CorrectiveStatus" AS ENUM ('OPEN', 'AWAITING_REASSESSMENT', 'DONE');

-- CreateEnum
CREATE TYPE "TimelineSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL', 'SUCCESS');

-- AlterTable
ALTER TABLE "CorrectiveAction" DROP COLUMN "status",
ADD COLUMN     "status" "CorrectiveStatus" NOT NULL DEFAULT 'OPEN';

-- AlterTable
ALTER TABLE "Event" DROP COLUMN "severity",
ADD COLUMN     "severity" "TimelineSeverity" NOT NULL;

-- AlterTable
ALTER TABLE "PersonException" DROP COLUMN "type",
ALTER COLUMN "reason" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Track" DROP COLUMN "updatedAt";

-- DropEnum
DROP TYPE "PersonExceptionType";
