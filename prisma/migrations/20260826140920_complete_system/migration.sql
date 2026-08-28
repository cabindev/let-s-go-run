-- AlterTable
ALTER TABLE `Achievement` DROP COLUMN `criteria`,
    ADD COLUMN `description` VARCHAR(191) NULL,
    ADD COLUMN `threshold` DOUBLE NOT NULL DEFAULT 1,
    ADD COLUMN `type` ENUM('EVENT_COUNT', 'TOTAL_DISTANCE', 'POINTS') NOT NULL DEFAULT 'EVENT_COUNT';

-- AlterTable
ALTER TABLE `Event` ADD COLUMN `endDate` DATETIME(3) NULL,
    ADD COLUMN `maxParticipants` INTEGER NULL,
    ADD COLUMN `points` INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `Registration` ADD COLUMN `note` TEXT NULL,
    ADD COLUMN `paidAt` DATETIME(3) NULL,
    MODIFY `status` ENUM('PENDING', 'WAITING', 'PAID', 'REJECTED', 'CANCELLED') NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE `User` DROP COLUMN `level`,
    ADD COLUMN `bio` TEXT NULL,
    ADD COLUMN `phone` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `Achievement_type_idx` ON `Achievement`(`type`);

-- CreateIndex
CREATE INDEX `Event_status_date_idx` ON `Event`(`status`, `date`);

-- CreateIndex
CREATE INDEX `Registration_status_idx` ON `Registration`(`status`);

-- CreateIndex
CREATE UNIQUE INDEX `Registration_userId_eventId_key` ON `Registration`(`userId`, `eventId`);

