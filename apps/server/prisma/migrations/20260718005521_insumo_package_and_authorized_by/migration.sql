-- AlterTable
ALTER TABLE "Insumo" ADD COLUMN     "packageLabel" TEXT,
ADD COLUMN     "packageSize" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "authorizedByUserId" TEXT;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_authorizedByUserId_fkey" FOREIGN KEY ("authorizedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
