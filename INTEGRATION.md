# Architect Hub — Admin Dashboard Integration Guide

This package contains **drop-in replacements** for every page in your existing
`architect-hub` frontend, plus two new utility files. It replaces mock data
with live API calls to the NestJS backend.

---

## Step 1 — Copy the files

Copy the contents of this zip into your existing `architect-hub/` project,
preserving the directory structure. Every file here replaces or adds to a file
in `src/`.

```
src/
├── lib/
│   └── api.ts                ← REPLACE (was empty / mock-based)
├── hooks/
│   └── useAuth.tsx            ← NEW
├── components/
│   ├── ui/
│   │   ├── modal.tsx         ← NEW
│   │   └── form.tsx          ← NEW
│   └── layout/
│       └── topbar.tsx        ← REPLACE (adds real user, notifications, logout)
└── app/
    ├── dashboard/page.tsx    ← REPLACE (live KPIs, real project data)
    ├── projects/
    │   ├── page.tsx          ← REPLACE (live list + Create Project modal)
    │   └── [id]/page.tsx     ← REPLACE (all 5 tabs live)
    ├── staff/page.tsx        ← REPLACE (create/edit/deactivate staff)
    ├── finance/page.tsx      ← REPLACE (firm-wide table + Update Payment modal)
    ├── daily-logs/page.tsx   ← REPLACE (admin view of all logs)
    ├── client-comms/page.tsx ← REPLACE (searchable comms across projects)
    ├── activity/page.tsx     ← REPLACE (firm-wide audit timeline)
    └── settings/page.tsx     ← REPLACE (profile, password, MFA)
```

---

## Step 2 — Environment variable

Create `.env.local` in the root of your `architect-hub/` project:

```env
NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1
```

Change the URL to match wherever your backend is running (staging/production URL
when you deploy).

---

## Step 3 — Install no extra packages

This integration uses only what you already have:

```json
"next", "react", "lucide-react", "clsx", "tailwind-merge"
```

No new `npm install` step needed.

---

## Step 4 — Keep your existing components unchanged

These files are **not replaced** — keep them exactly as they are:

- `src/components/layout/app-shell.tsx`
- `src/components/layout/sidebar.tsx`
- `src/components/ui/card.tsx`
- `src/components/ui/status-pill.tsx`
- `src/components/ui/dimension-bar.tsx`
- `src/lib/utils.ts`
- `src/data/mock.ts` (no longer imported anywhere, safe to keep)
- `tailwind.config.js`, `postcss.config.js`, `next.config.js`, `tsconfig.json`

---

## Step 5 — Start both services

**Backend:**
```bash
cd architect-hub-backend
cp .env.example .env   # fill in DATABASE_URL, JWT_ACCESS_SECRET, JWT_MFA_SECRET
npm install
npx prisma migrate dev
npx prisma db seed
npm run start:dev
```

**Frontend:**
```bash
cd architect-hub
npm install
npm run dev
```

Go to `http://localhost:3000` → login with the seeded admin:
- Email: `admin@architecthub.local`
- Password: `ChangeMe!2024Secure`

**Change this password immediately after first login via Settings → Change password.**

---

## What's now fully functional

| Page | What works |
|---|---|
| Dashboard | Live KPIs (active projects, outstanding payments, missing logs, monthly revenue), upcoming deadlines table, project health donut chart |
| Projects | Filterable/searchable list with health status colours; **Create Project** modal (assigns architects, sets supervisor, budget, dates); click-through to detail |
| Project detail | **Overview tab** — description, editable details, live activity timeline |
| | **Daily logs tab** — view all submitted logs; assigned architects can submit a new one |
| | **Documents tab** — upload any file (DWG, PDF, images, BOQ, etc.) via presigned S3 URL; download with one click |
| | **Client comms tab** — log and search meeting minutes, instructions, approvals, change requests |
| | **Finance tab** — view contract/invoiced/paid/outstanding; Admin/Supervisor can edit |
| | **Assign staff** button — assign or remove architects, reassign supervisor |
| | **Take Over Project** button — replace assigned architect, with reason logged |
| Staff | Full staff table by role; **Add staff member** modal (creates backend account with temp password); edit name/role/phone; deactivate |
| Finance | Firm-wide KPIs, per-project payment table; **Update** button opens payment editor with live outstanding balance |
| Daily logs | Admin view of all logs across all active projects, filterable by date and project |
| Client comms | All communications across all projects, searchable by text, filterable by type and project; **Log entry** modal |
| Activity | Firm-wide audit timeline per project with labelled action types |
| Settings | Edit profile, trigger password reset email, set up / disable MFA |
| Topbar | Shows real logged-in user name/role, live unread notification bell, sign-out button |

---

## Role behaviour

| Feature | Admin | Supervisor | Architect |
|---|---|---|---|
| Create project | ✅ | ✅ | ❌ |
| Edit project | ✅ | Own projects | ❌ |
| Assign architects | ✅ | Own projects | ❌ |
| Reassign supervisor | ✅ | ❌ | ❌ |
| Take over project | ✅ | Own projects | ❌ |
| Submit daily log | ✅ | ❌ | Assigned only |
| Update finance | ✅ | Own projects | ❌ |
| View staff page | ✅ | ❌ | ❌ |
| Add staff | ✅ | ❌ | ❌ |

All of these rules are enforced **server-side** — role checks in the frontend
are cosmetic UX, not the security boundary.

---

## Pre-go-live checklist

- [ ] Real `JWT_ACCESS_SECRET` and `JWT_MFA_SECRET` (`openssl rand -hex 64`)
- [ ] AWS S3 bucket created with correct CORS policy (allow PUT from your frontend origin)
- [ ] SMTP credentials set (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`) so password reset emails actually send
- [ ] `prisma migrate deploy` run against production database
- [ ] First admin password changed after seed
- [ ] TLS / domain configured (HTTPS required for secure cookies)
