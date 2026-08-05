# Architect Hub

A secure architectural knowledge continuity & project management platform.

## Quick start

### 1. Install dependencies

```powershell
npm install
```

### 2. Set up your database

Create a new Postgres database:

```powershell
psql -U postgres -c "CREATE DATABASE architect_hub;"
```

### 3. Configure environment variables

Copy `.env.example` to `.env`:

```powershell
copy .env.example .env
```

Edit `.env` and set your values:

```env
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/architect_hub"
AUTH_SECRET="run-this-to-generate: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
NEXTAUTH_URL="http://localhost:3000"
```

### 4. Generate Prisma client and push schema

```powershell
npx prisma generate
npx prisma db push
```

### 5. Seed the database

```powershell
npm run db:seed
```

### 6. Start the dev server

```powershell
npm run dev
```

Open http://localhost:3000

---

## Demo accounts

| Name          | Email               | Password     | Role            |
|---------------|---------------------|--------------|-----------------|
| Lewa Mutiso   | lewa@archub.io      | Password123! | Admin           |
| Naomi Otieno  | naomi@archub.io     | Password123! | Senior Architect|
| Samuel Kamau  | samuel@archub.io    | Password123! | Architect       |
| David Kiprono | david@archub.io     | Password123! | Senior Architect|
| Amina Wanjiru | amina@archub.io     | Password123! | Architect       |

---

## Useful commands

```powershell
npm run dev          # Start development server
npm run build        # Build for production
npx prisma studio    # Open database GUI in browser
npm run db:seed      # Re-seed the database
npx prisma migrate dev --name "your_change"  # Create a migration
```

---

## What's built

| Module            | Status    | Notes                                  |
|-------------------|-----------|----------------------------------------|
| Authentication    | ✅ Done   | Email + password + MFA (TOTP)          |
| Dashboard         | ✅ Done   | Live KPIs, charts, activity            |
| Projects          | ✅ Done   | Full CRUD, assign, reassign            |
| Daily logs        | ✅ Done   | Submit, view, filter, missing alerts   |
| Staff             | ✅ Done   | Create, edit, remove                   |
| Clients           | ✅ Done   | Create, manage, view projects          |
| Finance           | ✅ Done   | Record payments, view balances         |
| Client comms      | ✅ Done   | Log comments, resolve, filter          |
| Activity timeline | ✅ Done   | Unified audit feed                     |
| Documents         | ⏳ Next   | S3 upload (Phase E)                    |
| Email notifs      | ⏳ Next   | Resend/BullMQ (Phase E)                |
| MFA setup UI      | ⏳ Next   | QR code enrollment (Phase E)           |
| Deployment        | ⏳ Next   | Docker + CI/CD (Phase F)               |
