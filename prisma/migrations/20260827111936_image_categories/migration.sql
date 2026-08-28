-- AlterTable
ALTER TABLE `EventImage` ADD COLUMN `category` ENUM('SHIRT', 'MEDAL', 'ROUTE', 'SIZE_GUIDE', 'ATMOSPHERE', 'OTHER') NOT NULL DEFAULT 'OTHER';

-- CreateIndex
CREATE INDEX `EventImage_eventId_category_idx` ON `EventImage`(`eventId`, `category`);

