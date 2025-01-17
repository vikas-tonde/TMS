/*
  Warnings:

  - A unique constraint covering the columns `[trainingId,userId]` on the table `UserTraining` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "UserTraining" ALTER COLUMN "completionDate" DROP NOT NULL,
ALTER COLUMN "completionDate" DROP DEFAULT;

-- CreateIndex
CREATE UNIQUE INDEX "UserTraining_trainingId_userId_key" ON "UserTraining"("trainingId", "userId");
