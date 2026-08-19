/*
  Warnings:

  - You are about to drop the column `createAt` on the `Video` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "Video_createAt_idx";

-- AlterTable
ALTER TABLE "Video" DROP COLUMN "createAt",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "Video_createdAt_idx" ON "Video"("createdAt");
