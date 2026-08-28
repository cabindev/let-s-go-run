-- AlterTable
ALTER TABLE `Registration` ADD COLUMN `paymentMethod` VARCHAR(191) NULL,
    ADD COLUMN `stripePaymentIntentId` VARCHAR(191) NULL,
    ADD COLUMN `stripeSessionId` VARCHAR(191) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `Registration_stripeSessionId_key` ON `Registration`(`stripeSessionId`);
