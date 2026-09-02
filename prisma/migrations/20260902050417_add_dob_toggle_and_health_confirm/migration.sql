-- AlterTable
ALTER TABLE `Event` ADD COLUMN `collectDateOfBirth` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `Registration` ADD COLUMN `healthConfirmed` BOOLEAN NULL;
