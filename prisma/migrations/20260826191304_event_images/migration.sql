-- AlterTable
ALTER TABLE `Event` ADD COLUMN `announceAt` DATETIME(3) NULL,
    ADD COLUMN `contactUrl` VARCHAR(191) NULL,
    ADD COLUMN `resultSubmitUrl` VARCHAR(191) NULL,
    ADD COLUMN `rewards` TEXT NULL;

-- CreateTable
CREATE TABLE `EventImage` (
    `id` VARCHAR(191) NOT NULL,
    `eventId` VARCHAR(191) NOT NULL,
    `url` VARCHAR(191) NOT NULL,
    `caption` VARCHAR(191) NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `EventImage_eventId_idx`(`eventId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `EventImage` ADD CONSTRAINT `EventImage_eventId_fkey` FOREIGN KEY (`eventId`) REFERENCES `Event`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

