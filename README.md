# Director Website CMS

เว็บไซต์ผู้อำนวยการโรงเรียนอนุบาลชุมแสง (วัดทับกฤชกลาง)

## Stack
- React + Vite
- GitHub Pages
- Supabase Auth + PostgreSQL + Row Level Security
- Google Drive สำหรับไฟล์ภาพและเอกสารที่อนุมัติเผยแพร่
- Google Apps Script สำหรับแบบฟอร์มติดต่อ

## Local development
Requires Node.js 20.19+ (not required for the GitHub-based workflow).

```bash
npm install
npm run dev
```

## Environment
Copy `.env.example` to `.env.local` and set:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Never put Supabase secret/service_role keys, Google OAuth client secrets, or other private credentials in this repository or frontend.

## Database
Apply migrations in `supabase/migrations` using the Supabase SQL Editor. Read the migration comments and the bootstrap instructions before adding the first admin.
