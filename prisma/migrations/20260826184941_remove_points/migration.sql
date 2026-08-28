-- AlterTable
ALTER TABLE `Achievement` MODIFY `type` ENUM('EVENT_COUNT', 'TOTAL_DISTANCE') NOT NULL DEFAULT 'EVENT_COUNT';

-- AlterTable
ALTER TABLE `Event` DROP COLUMN `points`;

-- AlterTable
ALTER TABLE `RaceCategory` DROP COLUMN `points`;

-- AlterTable
ALTER TABLE `User` DROP COLUMN `points`;

