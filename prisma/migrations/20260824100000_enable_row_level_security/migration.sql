-- Closes a real exposure Supabase's own Security Advisor flagged:
-- every table in the public schema was reachable through Supabase's
-- auto-generated REST/GraphQL API (PostgREST) using the project's
-- public "anon" key -- a key that's DESIGNED to be exposed client-side,
-- not secret. Row-Level Security is the actual protection Supabase
-- expects every project to have; without it, anyone with that key
-- (discoverable via the Supabase dashboard, or any accidental exposure)
-- could read, edit, or delete every row in every table directly,
-- completely bypassing this app's own login and permission checks.
--
-- SAFE FOR THIS APP: the app itself never uses Supabase's client SDK,
-- the anon key, or the REST API at all -- it talks to Postgres directly
-- via Prisma over DATABASE_URL/DIRECT_URL, connecting as the `postgres`
-- role. That role owns these tables and is a Postgres superuser, which
-- means RLS never applies to it (Postgres RLS is bypassed by table
-- owners/superusers unless FORCE ROW LEVEL SECURITY is explicitly set,
-- which this migration does not do). So turning RLS on with zero
-- policies -- a default-deny stance for the anon/authenticated Supabase
-- roles -- closes the exposure with no effect on the app's own queries.
--
-- No policies are added because none are needed: nothing should ever
-- reach these tables except through this app's own API routes.

ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PasswordResetToken" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LoginEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Client" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Project" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProjectLifecycleEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DailyLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Document" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ClientComment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Payment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Invoice" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AssignmentRecord" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FirmSettings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Notification" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ActivityLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProjectPhase" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProjectTask" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TaskUpdate" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProjectMilestone" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProgressSnapshot" ENABLE ROW LEVEL SECURITY;
