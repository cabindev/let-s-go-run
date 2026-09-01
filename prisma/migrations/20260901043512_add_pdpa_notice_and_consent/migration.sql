-- AlterTable
ALTER TABLE `Event` ADD COLUMN `pdpaNotice` TEXT NULL;

-- AlterTable
ALTER TABLE `Registration` ADD COLUMN `pdpaConsentAt` DATETIME(3) NULL;
