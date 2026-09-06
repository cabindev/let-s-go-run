-- AlterTable
ALTER TABLE `ProductImage` ADD COLUMN `category` ENUM('FRONT', 'BACK', 'MODEL', 'DETAIL', 'SIZE_GUIDE', 'OTHER') NOT NULL DEFAULT 'OTHER';

-- CreateIndex
CREATE INDEX `ProductImage_productId_category_idx` ON `ProductImage`(`productId`, `category`);
