-- เลข BIB ซ้ำกันได้ถ้าคนละระยะ (ผู้จัดพิมพ์ BIB แยกชุดต่อระยะ)
-- Registration_eventId_idx ยังครอบ foreign key ของ eventId อยู่ ลบ unique ตัวเดิมได้โดยไม่ต้องแตะ foreign key

-- DropIndex
DROP INDEX `Registration_eventId_bib_key` ON `Registration`;

-- CreateIndex
CREATE UNIQUE INDEX `Registration_eventId_categoryId_bib_key` ON `Registration`(`eventId`, `categoryId`, `bib`);
