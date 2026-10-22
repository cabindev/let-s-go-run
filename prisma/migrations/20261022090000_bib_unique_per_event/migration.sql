-- เลข BIB กลับมาไม่ซ้ำกันทั้งงาน (มาตรฐานงานวิ่งสากล: หนึ่งเลข = หนึ่งคนในงาน ใช้ต่อกับผลวิ่ง/รูป/ชิปจับเวลา)
-- แทน unique (eventId, categoryId, bib) จาก 20261010150000_bib_unique_per_category
--
-- งานเก่าที่พิมพ์ BIB แยกชุดต่อระยะไปแล้ว (เลขเดียวกันอยู่คนละระยะ) ไม่เปลี่ยนเลขย้อนหลัง —
-- ตั้ง bibScope = categoryId ให้ทุกใบของงานนั้น แล้ว unique (eventId, bibScope, bib) ยังผ่าน
-- ใบใหม่ที่ระบบออกมี bibScope = '' เสมอ → ไม่ซ้ำทั้งงาน

-- AlterTable
ALTER TABLE `Registration` ADD COLUMN `bibScope` VARCHAR(32) NOT NULL DEFAULT '';

-- งานที่มีเลข BIB ซ้ำข้ามระยะ → แยกขอบเขตตามระยะทั้งงาน
-- (GROUP BY ทำให้ derived table ถูก materialize จึงไม่ติด error 1093 ของ MySQL)
UPDATE `Registration` r
JOIN (
    SELECT DISTINCT `eventId` FROM (
        SELECT `eventId` FROM `Registration`
        WHERE `bib` IS NOT NULL
        GROUP BY `eventId`, `bib`
        HAVING COUNT(*) > 1
    ) dup
) legacy ON legacy.`eventId` = r.`eventId`
SET r.`bibScope` = COALESCE(r.`categoryId`, '');

-- DropIndex (Registration_eventId_idx ยังครอบ foreign key ของ eventId อยู่)
DROP INDEX `Registration_eventId_categoryId_bib_key` ON `Registration`;

-- CreateIndex
CREATE UNIQUE INDEX `Registration_eventId_bibScope_bib_key` ON `Registration`(`eventId`, `bibScope`, `bib`);

-- AlterTable: ช่วงเลข BIB ต่อระยะ
ALTER TABLE `RaceCategory` ADD COLUMN `bibCounter` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `bibEnd` INTEGER NULL,
    ADD COLUMN `bibPrefix` VARCHAR(3) NULL,
    ADD COLUMN `bibStart` INTEGER NULL;

-- CreateTable
CREATE TABLE `BibChangeLog` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `registrationId` VARCHAR(191) NOT NULL,
    `eventId` VARCHAR(191) NOT NULL,
    `oldBib` VARCHAR(191) NULL,
    `newBib` VARCHAR(191) NULL,
    `dbUser` VARCHAR(191) NULL,
    `changedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `BibChangeLog_registrationId_idx`(`registrationId`),
    INDEX `BibChangeLog_eventId_idx`(`eventId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- เลข BIB ที่ออกแล้วห้ามเปลี่ยน — กันทั้งจากแอปและการแก้ตรงในฐานข้อมูล (phpMyAdmin)
-- แก้จริงจำเป็น (เช่นพิมพ์ผิดก่อนส่งโรงพิมพ์) ต้องตั้งใจ: SET @allow_bib_change = 1; ก่อน UPDATE ในเซสชันเดียวกัน
CREATE TRIGGER `Registration_bib_guard` BEFORE UPDATE ON `Registration`
FOR EACH ROW
BEGIN
    IF OLD.`bib` IS NOT NULL
       AND (NOT (NEW.`bib` <=> OLD.`bib`) OR NEW.`bibScope` <> OLD.`bibScope`)
       AND COALESCE(@allow_bib_change, 0) <> 1 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'BIB is immutable once issued. SET @allow_bib_change = 1 to override (logged in BibChangeLog).';
    END IF;
END;

-- บันทึกทุกการเปลี่ยนเลข BIB ที่ออกไปแล้ว (รวมที่ override)
CREATE TRIGGER `Registration_bib_log` AFTER UPDATE ON `Registration`
FOR EACH ROW
BEGIN
    IF OLD.`bib` IS NOT NULL AND NOT (NEW.`bib` <=> OLD.`bib`) THEN
        INSERT INTO `BibChangeLog` (`registrationId`, `eventId`, `oldBib`, `newBib`, `dbUser`)
        VALUES (NEW.`id`, NEW.`eventId`, OLD.`bib`, NEW.`bib`, CURRENT_USER());
    END IF;
END;
