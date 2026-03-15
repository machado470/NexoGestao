-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'BRL',
ADD COLUMN     "timezone" TEXT NOT NULL DEFAULT 'America/Sao_Paulo';
