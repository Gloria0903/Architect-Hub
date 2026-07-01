# Architect Hub — Frontend (Phase C)

This is the frontend slice of Architect Hub: a Next.js 15 (App Router) +
TypeScript + Tailwind app implementing the "vellum & blueprint" design
system, with mock data standing in for the database for now.

## What's included

- Login screen (credentials + MFA step)
- Dashboard (KPI cards, project health donut, weekly logs chart, revenue
  chart, active projects table, recent activity)
- Projects list (filterable by status)
- Project detail (overview, daily logs, documents, client comms, finance
  tabs, plus the Take Over Project modal)
- Daily logs list + submission form
- Sidebar navigation for every module in the spec (placeholder pages for
  Documents, Finance, Client comms, Activity, Staff, Settings — these get
  built out in Phase D/E)

All data currently comes from `src/data/mock.ts`. Nothing is wired to a
database yet — that's Phase B/D, once you're happy with the UI.

## Run it locally

```bash
npm install
npm run dev
```

Then open http://localhost:3000 — it redirects to `/login`. Click
through the login form (any input works, it's UI-only right now) to land
on `/dashboard`.

Requires Node.js 18.18+ (Next.js 15 requirement).

## Design system reference

Colors, fonts, and spacing are defined in `tailwind.config.js`:

- `vellum` (#ECEFEE) — page background
- `ink` (#13191F) / `ink-sidebar` (#0F1620) — text and sidebar
- `blueprint` (#2451C4) — primary accent
- `moss` / `ochre` / `brick` — on track / at risk / delayed status colors
- Fonts: Space Grotesk (display/headings), Inter (body/UI), IBM Plex Mono
  (project numbers, dates, money)

The signature UI element is the `DimensionBar` component
(`src/components/ui/dimension-bar.tsx`) — progress shown as an
architectural dimension line rather than a generic progress bar.

## Next steps

Once you approve this UI, the next phases are:

- **Phase B**: Prisma schema + Postgres, real API routes
- **Phase D**: wire Projects, Daily logs, Documents to the database
- **Phase E**: Finance, Notifications, Activity timeline, Take Over
  Project logic (currently a UI-only modal)
- **Phase F**: auth (Auth.js + MFA), RBAC, security hardening, testing,
  deployment config
