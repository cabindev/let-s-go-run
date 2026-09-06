-- AlterTable
ALTER TABLE `Registration` ADD COLUMN `paymentIssueAt` DATETIME(3) NULL;

-- CreateIndex
CREATE INDEX `Registration_paymentIssueAt_idx` ON `Registration`(`paymentIssueAt`);
