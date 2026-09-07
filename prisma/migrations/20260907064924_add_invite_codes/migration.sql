-- AlterTable
ALTER TABLE `Registration` ADD COLUMN `inviteCodeId` VARCHAR(191) NULL,
    ADD COLUMN `inviteGroupName` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `InviteCode` (
    `id` VARCHAR(191) NOT NULL,
    `eventId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `groupName` VARCHAR(191) NOT NULL,
    `discountPercent` INTEGER NOT NULL DEFAULT 100,
    `maxUses` INTEGER NOT NULL DEFAULT 1,
    `usedCount` INTEGER NOT NULL DEFAULT 0,
    `expiresAt` DATETIME(3) NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `note` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `InviteCode_code_key`(`code`),
    INDEX `InviteCode_eventId_idx`(`eventId`),
    INDEX `InviteCode_eventId_groupName_idx`(`eventId`, `groupName`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Registration_inviteCodeId_idx` ON `Registration`(`inviteCodeId`);

-- CreateIndex
CREATE INDEX `Registration_eventId_inviteCodeId_idx` ON `Registration`(`eventId`, `inviteCodeId`);

-- AddForeignKey
ALTER TABLE `Registration` ADD CONSTRAINT `Registration_inviteCodeId_fkey` FOREIGN KEY (`inviteCodeId`) REFERENCES `InviteCode`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InviteCode` ADD CONSTRAINT `InviteCode_eventId_fkey` FOREIGN KEY (`eventId`) REFERENCES `Event`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
