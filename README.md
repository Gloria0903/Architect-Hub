## What's built

| Module            | Status    | Notes                                  |
|-------------------|-----------|-----------------------------------------|
| Authentication    | ✅ Done   | Email + password + MFA (TOTP)          |
| Dashboard         | ✅ Done   | Live KPIs, charts, activity — scoped by role |
| Projects          | ✅ Done   | Full CRUD, assign, reassign            |
| Daily logs        | ✅ Done   | Submit, view, filter, missing alerts   |
| Staff             | ✅ Done   | Create, edit, remove                   |
| Clients           | ✅ Done   | Create, manage, view projects — scoped by role |
| Finance           | ✅ Done   | Record payments, view balances         |
| Client comms      | ✅ Done   | Log comments, resolve, filter          |
| Activity timeline | ✅ Done   | Unified audit feed — scoped by role    |
| Documents         | ✅ Done   | S3 upload, versioning, drag-and-drop   |
| Email notifs      | ✅ Done   | Resend + BullMQ worker                 |
| MFA setup UI      | ✅ Done   | QR code enrollment                     |
| Avatars           | ✅ Done   | Upload/remove, content-validated       |
| Deployment        | ✅ Done   | Docker + docker-compose + CI           |
| Rate limiting     | ✅ Done   | Per-IP, tiered by endpoint sensitivity |
| CSRF protection   | ✅ Done   | Origin/Referer verification (middleware) |
| Take Over Project | ✅ Done   | Handover dossier at `/projects/[id]/takeover` — logs, docs, comms, financials, timeline, admin-gated reassign |
| Firm settings     | ✅ Done   | Admin-only "Firm settings" card on the Settings page; firm name is now stored in the DB (`FirmSettings`) instead of hardcoded, used on the login page and sidebar |
| Client Portal     | ✅ Done   | Proposal §10 — clients now get their own login (`/client-portal`), scoped to their own projects: progress, documents you've flagged visible to them, and a message thread. Enable per-client from the Clients page |
| Senior Architect role | Not built | Proposal defines Admin / Senior Architect / Architect; the app still only has two roles (`ADMIN`, `ARCHITECT`). Left out for now by request — see note below if you want it added back |