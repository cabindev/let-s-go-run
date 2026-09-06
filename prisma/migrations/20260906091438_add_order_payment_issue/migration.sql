-- AlterTable
ALTER TABLE `Order` ADD COLUMN `paymentIssueAt` DATETIME(3) NULL;

-- CreateIndex
CREATE INDEX `Order_paymentIssueAt_idx` ON `Order`(`paymentIssueAt`);
