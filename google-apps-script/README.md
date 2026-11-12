# Google Apps Script – Google Drive Bridge

ระบบนี้ใช้ Google Apps Script (GAS) และ DriveApp เท่านั้น ไม่ใช้ Google Drive API หรือ OAuth Client ID

## 1. สร้าง Apps Script

1. เปิด https://script.google.com/ ด้วยบัญชี Google ที่มีสิทธิ์จัดการโฟลเดอร์ Drive หลัก
2. สร้างโปรเจกต์ใหม่ ตั้งชื่อ `Director CMS Drive Bridge`
3. เปิดไฟล์ `Code.gs` แล้วคัดลอกเนื้อหาจากไฟล์ `google-apps-script/Code.gs` ใน Repository นี้ไปวางแทน
4. กด Save
5. เลือกฟังก์ชัน `doPost` ไม่ต้องกด Run เพราะต้องรับข้อมูลจากเว็บไซต์

## 2. อนุญาตการเข้าถึง Google Drive

1. กด Deploy → New deployment
2. เลือกประเภท Web app
3. Execute as: **Me**
4. Who has access: **Anyone**
5. กด Deploy และอนุญาตสิทธิ์ Google Drive / External requests ตามที่ Google แสดง
6. คัดลอก Web app URL ที่ลงท้ายด้วย `/exec`

แม้ Web app จะรับคำขอจาก Anyone แต่ทุกคำสั่งจะตรวจสอบ Supabase access token และตรวจสอบว่าผู้ใช้ยังอยู่ในตาราง `admin_users` และ `is_active=true` ก่อนทำงานกับ Drive

## 3. ตั้งค่า Supabase

เปิด Supabase Dashboard → Edge Functions → Secrets:

https://supabase.com/dashboard/project/njcyivxrtfxrppfyodip/functions/secrets

เพิ่ม Secret ดังนี้:

- Name: `GAS_WEB_APP_URL`
- Value: Web app URL ที่คัดลอกมาจาก Apps Script (ต้องเป็น URL `/exec`)

กด Save จากนั้น Edge Function `drive-media` ที่ deploy ไว้จะอ่านค่าได้ทันที ไม่ต้อง deploy ซ้ำ

## 4. โฟลเดอร์ที่ระบบสร้างให้

เมื่ออัปโหลดครั้งแรก ระบบจะสร้างโฟลเดอร์ย่อยภายในโฟลเดอร์หลักที่กำหนดไว้โดยอัตโนมัติ:

- `01 ภาพกิจกรรม`
- `02 ภาพประกอบเว็บไซต์`
- `03 เอกสารเผยแพร่`
- `04 เอกสารส่วนตัวและสำรอง`

โฟลเดอร์หลักยังคงเป็นส่วนตัว ระบบให้สิทธิ์ Anyone with the link เฉพาะไฟล์ที่ผู้ดูแลบันทึกเป็นสถานะเผยแพร่เท่านั้น ส่วนไฟล์ฉบับร่างจะคงเป็นส่วนตัว

## 5. ข้อจำกัด

- ขนาดไฟล์ต่อรายการไม่เกิน 4 MB ในรุ่นแรก
- รองรับภาพ JPG/PNG/GIF/WebP, PDF, ไฟล์ Microsoft Office และ TXT
- การยกเลิกเผยแพร่จะตั้งสิทธิ์ไฟล์กลับเป็น Private
- การลบรายการใน CMS ไม่ลบไฟล์ใน Drive โดยอัตโนมัติ เพื่อป้องกันการลบไฟล์ต้นฉบับโดยไม่ตั้งใจ
- บัญชี Google ที่ deploy Web app ต้องมีสิทธิ์เข้าถึงโฟลเดอร์หลัก
