-- AlterTable
ALTER TABLE `Event` ADD COLUMN `offerShipping` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `Registration` ADD COLUMN `deliveryMethod` VARCHAR(191) NULL;
