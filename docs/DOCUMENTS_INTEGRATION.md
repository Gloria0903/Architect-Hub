# Documents module — integration guide

## 1. Install dependencies

```bash
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

No drag-and-drop library needed — the uploader uses native HTML5 DnD to
keep the dependency footprint small.

## 2. ShadCN components used

The document components assume these are already generated under
`@/components/ui/`. If any are missing:

```bash
npx shadcn@latest add button input badge select dialog progress
```

## 3. Environment variables

Add to `.env` / `.env.example`:

```
AWS_REGION="us-east-1"
AWS_S3_BUCKET="architect-hub-documents"
# Leave these two unset in production if the app runs on an IAM role
# (ECS/EKS/EC2 instance profile) — the SDK will use the role automatically.
AWS_ACCESS_KEY_ID=""
AWS_SECRET_ACCESS_KEY=""
```

## 4. S3 bucket setup

**Block all public access** on the bucket — every read/write goes through
short-lived presigned URLs generated server-side, never a public bucket
policy.

**Enable server-side encryption** (SSE-S3 or SSE-KMS) as the bucket default,
matching the AES-256-at-rest requirement.

**CORS configuration** (required — the browser uploads directly to S3 via
the presigned PUT URL, so the bucket must allow it):

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["PUT", "GET"],
    "AllowedOrigins": ["https://your-production-domain.com", "http://localhost:3000"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }
]
```

**IAM policy** for the app's execution role (least privilege — matches the
security requirement in the spec):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"],
      "Resource": "arn:aws:s3:::architect-hub-documents/projects/*"
    }
  ]
}
```

Scoping the resource to `projects/*` means even a compromised app process
can't touch anything outside the documents prefix.

## 5. Apply the schema changes

See `prisma/schema-additions.md` in this bundle. After editing
`schema.prisma`:

```bash
npx prisma migrate dev --name "add_document_versioning"
```

Since your existing `Document` table already has rows with
`uploadedById` as a bare string, the migration will need those to satisfy
the new foreign key — if you have no real uploaded documents in dev/prod
yet (likely, since this module wasn't live), this is a clean migration. If
you do have existing rows, let me know and I'll write a data-backfill step.

## 6. Wire the component into a project page

Drop this into wherever your project detail page renders tabs (Overview /
Daily Logs / Finance / etc.):

```tsx
import { ProjectDocuments } from "@/components/documents/document-list";

// inside the "Documents" tab panel:
<ProjectDocuments projectId={project.id} />
```

The component is self-contained — it fetches, filters, uploads, and
manages versions on its own. It only needs `projectId`.

## 7. What's enforced server-side (not just in the UI)

- Auth required on every route (`auth()` session check)
- Project access rule reused from `lib/project-access.ts` — Admins see
  everything, Architects/Supervisors only their own assigned projects
- File type + size re-validated on the confirm step, not just at presign
  time (a client could otherwise presign a valid file and then PUT
  something else)
- Upload keys are checked to belong to the claimed project prefix before a
  DB row is created
- Deletes are soft (`deletedAt`) and restricted to the uploader or an Admin
  — never a hard S3 delete from the UI path, so nothing is unrecoverable
  from a misclick
