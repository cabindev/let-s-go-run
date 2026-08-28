-- AlterTable
ALTER TABLE `Event` DROP COLUMN `resultSubmitUrl`;

-- AlterTable
ALTER TABLE `Registration` ADD COLUMN `bib` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `RunSubmission` (
    `id` VARCHAR(191) NOT NULL,
    `registrationId` VARCHAR(191) NOT NULL,
    `distance` DOUBLE NOT NULL,
    `runDate` DATETIME(3) NOT NULL,
    `evidenceUrl` VARCHAR(191) NULL,
    `note` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `RunSubmission_registrationId_idx`(`registrationId`),
    INDEX `RunSubmission_runDate_idx`(`runDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `Registration_eventId_bib_key` ON `Registration`(`eventId`, `bib`);

-- AddForeignKey
ALTER TABLE `RunSubmission` ADD CONSTRAINT `RunSubmission_registrationId_fkey` FOREIGN KEY (`registrationId`) REFERENCES `Registration`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

