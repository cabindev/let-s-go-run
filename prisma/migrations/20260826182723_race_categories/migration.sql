-- AlterTable
ALTER TABLE `Event` ADD COLUMN `organizer` VARCHAR(191) NULL,
    ADD COLUMN `province` VARCHAR(191) NULL,
    ADD COLUMN `registerCloseAt` DATETIME(3) NULL,
    ADD COLUMN `registerOpenAt` DATETIME(3) NULL,
    ADD COLUMN `type` ENUM('ONSITE', 'VIRTUAL') NOT NULL DEFAULT 'ONSITE';

-- AlterTable
ALTER TABLE `Registration` ADD COLUMN `address` TEXT NULL,
    ADD COLUMN `categoryId` VARCHAR(191) NULL,
    ADD COLUMN `emergencyName` VARCHAR(191) NULL,
    ADD COLUMN `emergencyPhone` VARCHAR(191) NULL,
    ADD COLUMN `fullName` VARCHAR(191) NULL,
    ADD COLUMN `phone` VARCHAR(191) NULL,
    ADD COLUMN `shirtSize` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `RaceCategory` (
    `id` VARCHAR(191) NOT NULL,
    `eventId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `distance` DOUBLE NOT NULL,
    `price` DOUBLE NOT NULL,
    `points` INTEGER NOT NULL DEFAULT 0,
    `maxSlots` INTEGER NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `RaceCategory_eventId_idx`(`eventId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Event_province_idx` ON `Event`(`province`);

-- CreateIndex
CREATE INDEX `Registration_categoryId_idx` ON `Registration`(`categoryId`);

-- AddForeignKey
ALTER TABLE `RaceCategory` ADD CONSTRAINT `RaceCategory_eventId_fkey` FOREIGN KEY (`eventId`) REFERENCES `Event`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Registration` ADD CONSTRAINT `Registration_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `RaceCategory`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

