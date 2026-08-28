-- AlterTable
ALTER TABLE `Registration` ADD COLUMN `expiresAt` DATETIME(3) NULL,
    MODIFY `status` ENUM('PENDING', 'WAITING', 'PAID', 'REJECTED', 'EXPIRED', 'CANCELLED') NOT NULL DEFAULT 'PENDING';

-- CreateIndex
CREATE INDEX `Registration_status_expiresAt_idx` ON `Registration`(`status`, `expiresAt`);

