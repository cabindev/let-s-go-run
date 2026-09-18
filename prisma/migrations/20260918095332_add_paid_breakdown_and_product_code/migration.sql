-- AlterTable
ALTER TABLE `OrderItem` ADD COLUMN `productSlug` VARCHAR(191) NULL,
    ADD COLUMN `variantSku` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `Registration` ADD COLUMN `paidEntry` DOUBLE NULL,
    ADD COLUMN `paidShipping` DOUBLE NULL;
