-- AlterTable
ALTER TABLE `Event` ADD COLUMN `collectBloodType` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `collectGender` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `collectNationalId` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `collectPreviousParticipation` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `Registration` ADD COLUMN `bloodType` VARCHAR(191) NULL,
    ADD COLUMN `gender` VARCHAR(191) NULL,
    ADD COLUMN `hasParticipatedBefore` BOOLEAN NULL,
    ADD COLUMN `nationalId` VARCHAR(191) NULL;
