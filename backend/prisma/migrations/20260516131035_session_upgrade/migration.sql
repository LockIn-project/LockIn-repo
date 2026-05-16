/*
  Warnings:

  - Added the required column `lastUpdatedAt` to the `Session` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'ABANDONED');

-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "adaptiveState" JSONB,
ADD COLUMN     "lastUpdatedAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "status" "SessionStatus" NOT NULL DEFAULT 'ACTIVE',
ALTER COLUMN "productiveMinutes" SET DEFAULT 0,
ALTER COLUMN "distractionCount" SET DEFAULT 0,
ALTER COLUMN "idleTime" SET DEFAULT 0,
ALTER COLUMN "focusScore" SET DEFAULT 50,
ALTER COLUMN "startedAt" SET DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "endedAt" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Achievement_userId_idx" ON "Achievement"("userId");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_status_idx" ON "Session"("status");
