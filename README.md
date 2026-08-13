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
| Take Over Project | ⏳ Next   | Dedicated handover view — not yet built |
| Firm settings     | ⏳ Next   | Currently hardcoded placeholder text   |