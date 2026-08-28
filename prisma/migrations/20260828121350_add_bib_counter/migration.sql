-- AlterTable
ALTER TABLE `Event` ADD COLUMN `bibCounter` INTEGER NOT NULL DEFAULT 0;

-- Backfill: ตั้งค่าเริ่มต้นให้ต่อจากเลข BIB สูงสุดที่เคยออกไปแล้วของแต่ละงาน
-- กันไม่ให้ตัวนับใหม่ย้อนกลับไปออกเลขซ้ำกับที่มีอยู่แล้ว
UPDATE `Event` e
SET e.bibCounter = COALESCE(
    (SELECT MAX(CAST(r.bib AS UNSIGNED)) FROM `Registration` r WHERE r.eventId = e.id AND r.bib IS NOT NULL),
    0
);
