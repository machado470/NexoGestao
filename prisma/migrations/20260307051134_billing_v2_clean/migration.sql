/*
  Warnings:

  - You are about to drop the column `canceledAt` on the `Invoice` table. All the data in the column will be lost.
  - You are about to drop the column `dueDate` on the `Invoice` table. All the data in the column will be lost.
  - You are about to drop the column `issuedAt` on the `Invoice` table. All the data in the column will be lost.
  - You are about to drop the column `notes` on the `Invoice` table. All the data in the column will be lost.
  - You are about to drop the column `paidAt` on the `Invoice` table. All the data in the column will be lost.
  - You are about to drop the column `confirmedAt` on the `Referral` table. All the data in the column will be lost.
  - You are about to drop the column `paidAt` on the `Referral` table. All the data in the column will be lost.
  - You are about to drop the column `referredPhone` on the `Referral` table. All the data in the column will be lost.
  - You are about to drop the column `referrerPhone` on the `Referral` table. All the data in the column will be lost.
  - You are about to drop the column `cancellationReason` on the `ServiceOrder` table. All the data in the column will be lost.
  - You are about to drop the column `executionEndedAt` on the `ServiceOrder` table. All the data in the column will be lost.
  - You are about to drop the column `executionStartedAt` on the `ServiceOrder` table. All the data in the column will be lost.
  - You are about to drop the column `outcomeSummary` on the `ServiceOrder` table. All the data in the column will be lost.
  - You are about to drop the column `errorCode` on the `WhatsAppMessage` table. All the data in the column will be lost.
  - You are about to drop the column `errorMessage` on the `WhatsAppMessage` table. All the data in the column will be lost.
  - You are about to drop the column `lockedAt` on the `WhatsAppMessage` table. All the data in the column will be lost.
  - You are about to drop the column `lockedBy` on the `WhatsAppMessage` table. All the data in the column will be lost.
  - You are about to drop the column `metadata` on the `WhatsAppMessage` table. All the data in the column will be lost.
  - You are about to drop the column `provider` on the `WhatsAppMessage` table. All the data in the column will be lost.
  - You are about to drop the column `providerMessageId` on the `WhatsAppMessage` table. All the data in the column will be lost.
  - You are about to drop the column `sentAt` on the `WhatsAppMessage` table. All the data in the column will be lost.
  - You are about to drop the column `templateKey` on the `WhatsAppMessage` table. All the data in the column will be lost.
  - You are about to drop the `AutomationExecution` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `AutomationRule` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Execution` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `QueueJob` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `WebhookDelivery` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `WebhookEndpoint` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[orgId,bucket]` on the table `GovernanceRun` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `bucket` to the `GovernanceRun` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "PlanName" AS ENUM ('FREE', 'STARTER', 'PRO', 'BUSINESS');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'TRIALING', 'CANCELED', 'PAST_DUE');

-- CreateEnum
CREATE TYPE "BillingEventType" AS ENUM ('PAYMENT', 'REFUND', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "BillingEventStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

-- DropForeignKey
ALTER TABLE "AutomationExecution" DROP CONSTRAINT "AutomationExecution_orgId_fkey";

-- DropForeignKey
ALTER TABLE "AutomationExecution" DROP CONSTRAINT "AutomationExecution_ruleId_fkey";

-- DropForeignKey
ALTER TABLE "AutomationRule" DROP CONSTRAINT "AutomationRule_orgId_fkey";

-- DropForeignKey
ALTER TABLE "Execution" DROP CONSTRAINT "Execution_customerId_fkey";

-- DropForeignKey
ALTER TABLE "Execution" DROP CONSTRAINT "Execution_executorPersonId_fkey";

-- DropForeignKey
ALTER TABLE "Execution" DROP CONSTRAINT "Execution_orgId_fkey";

-- DropForeignKey
ALTER TABLE "Execution" DROP CONSTRAINT "Execution_serviceOrderId_fkey";

-- DropForeignKey
ALTER TABLE "WebhookDelivery" DROP CONSTRAINT "WebhookDelivery_endpointId_fkey";

-- DropForeignKey
ALTER TABLE "WebhookEndpoint" DROP CONSTRAINT "WebhookEndpoint_orgId_fkey";

-- DropIndex
DROP INDEX "Charge_orgId_serviceOrderId_key";

-- DropIndex
DROP INDEX "Expense_orgId_category_idx";

-- DropIndex
DROP INDEX "Expense_orgId_date_idx";

-- DropIndex
DROP INDEX "Expense_orgId_idx";

-- DropIndex
DROP INDEX "Invoice_customerId_idx";

-- DropIndex
DROP INDEX "Invoice_orgId_idx";

-- DropIndex
DROP INDEX "Invoice_orgId_number_key";

-- DropIndex
DROP INDEX "Invoice_orgId_status_idx";

-- DropIndex
DROP INDEX "Launch_orgId_date_idx";

-- DropIndex
DROP INDEX "Launch_orgId_idx";

-- DropIndex
DROP INDEX "Launch_orgId_type_idx";

-- DropIndex
DROP INDEX "Payment_orgId_chargeId_key";

-- DropIndex
DROP INDEX "Referral_orgId_idx";

-- DropIndex
DROP INDEX "Referral_orgId_status_idx";

-- DropIndex
DROP INDEX "Referral_referrerEmail_idx";

-- DropIndex
DROP INDEX "WhatsAppMessage_customerId_createdAt_idx";

-- DropIndex
DROP INDEX "WhatsAppMessage_orgId_entityType_entityId_idx";

-- DropIndex
DROP INDEX "WhatsAppMessage_orgId_messageType_createdAt_idx";

-- DropIndex
DROP INDEX "WhatsAppMessage_orgId_status_createdAt_idx";

-- DropIndex
DROP INDEX "WhatsAppMessage_orgId_status_lockedAt_createdAt_idx";

-- DropIndex
DROP INDEX "WhatsAppTemplate_orgId_channel_isActive_idx";

-- DropIndex
DROP INDEX "WhatsAppTemplate_orgId_createdAt_idx";

-- DropIndex
DROP INDEX "WhatsAppTemplate_orgId_key_key";

-- AlterTable
ALTER TABLE "GovernanceRun" ADD COLUMN     "bucket" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Invoice" DROP COLUMN "canceledAt",
DROP COLUMN "dueDate",
DROP COLUMN "issuedAt",
DROP COLUMN "notes",
DROP COLUMN "paidAt";

-- AlterTable
ALTER TABLE "Referral" DROP COLUMN "confirmedAt",
DROP COLUMN "paidAt",
DROP COLUMN "referredPhone",
DROP COLUMN "referrerPhone";

-- AlterTable
ALTER TABLE "ServiceOrder" DROP COLUMN "cancellationReason",
DROP COLUMN "executionEndedAt",
DROP COLUMN "executionStartedAt",
DROP COLUMN "outcomeSummary";

-- AlterTable
ALTER TABLE "WhatsAppMessage" DROP COLUMN "errorCode",
DROP COLUMN "errorMessage",
DROP COLUMN "lockedAt",
DROP COLUMN "lockedBy",
DROP COLUMN "metadata",
DROP COLUMN "provider",
DROP COLUMN "providerMessageId",
DROP COLUMN "sentAt",
DROP COLUMN "templateKey";

-- DropTable
DROP TABLE "AutomationExecution";

-- DropTable
DROP TABLE "AutomationRule";

-- DropTable
DROP TABLE "Execution";

-- DropTable
DROP TABLE "QueueJob";

-- DropTable
DROP TABLE "WebhookDelivery";

-- DropTable
DROP TABLE "WebhookEndpoint";

-- DropEnum
DROP TYPE "AutomationActionType";

-- DropEnum
DROP TYPE "AutomationExecutionStatus";

-- DropEnum
DROP TYPE "AutomationTrigger";

-- DropEnum
DROP TYPE "WebhookDeliveryStatus";

-- CreateTable
CREATE TABLE "Plan" (
    "id" TEXT NOT NULL,
    "name" "PlanName" NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "currentPeriodStart" TIMESTAMP(3) NOT NULL,
    "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
    "canceledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingEvent" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "type" "BillingEventType" NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "status" "BillingEventStatus" NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillingEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Plan_name_key" ON "Plan"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_orgId_key" ON "Subscription"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "GovernanceRun_orgId_bucket_key" ON "GovernanceRun"("orgId", "bucket");

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingEvent" ADD CONSTRAINT "BillingEvent_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
