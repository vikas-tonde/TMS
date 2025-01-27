/*
  Warnings:

  - Added the required column `adminId` to the `Remark` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Remark" ADD COLUMN     "adminId" BIGINT NOT NULL;

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "joinedAt" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Remark" ADD CONSTRAINT "Remark_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
