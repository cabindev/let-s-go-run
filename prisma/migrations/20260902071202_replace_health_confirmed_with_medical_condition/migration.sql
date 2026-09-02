-- AlterTable
ALTER TABLE `Registration` DROP COLUMN `healthConfirmed`,
    ADD COLUMN `hasMedicalCondition` BOOLEAN NULL,
    ADD COLUMN `medicalConditionDetail` TEXT NULL;
