# Schema changes needed for the Documents module

Apply these changes to `prisma/schema.prisma`, then run:

```
npx prisma migrate dev --name "add_document_versioning"
```

## 1. Add a `DocumentCategory` enum

Add near your other enums:

```prisma
enum DocumentCategory {
  DRAWING
  BOQ
  CONTRACT
  SITE_REPORT
  PRESENTATION
  OTHER
}
```

## 2. Replace the existing `Document` model

Your current model tracks a `version` number but has no way to link versions
of the same file together, and `uploadedById` is a bare string with no
relation — so you can't show "uploaded by" without a second query. Replace it
with:

```prisma
model Document {
  id           String           @id @default(cuid())
  name         String
  category     DocumentCategory @default(OTHER)
  fileKey      String
  fileUrl      String
  fileSize     Int
  mimeType     String
  version      Int              @default(1)
  isLatest     Boolean          @default(true)
  uploadedAt   DateTime         @default(now())
  deletedAt    DateTime?

  projectId    String
  project      Project          @relation(fields: [projectId], references: [id], onDelete: Cascade)

  uploadedById String
  uploadedBy   User             @relation("DocumentUploader", fields: [uploadedById], references: [id])

  // Self-relation: every version after v1 points back to the original document.
  // The original document (v1) has parentId = null and is the "root" of the chain.
  parentId     String?
  parent       Document?        @relation("DocumentVersions", fields: [parentId], references: [id], onDelete: Cascade)
  versions     Document[]       @relation("DocumentVersions")

  @@index([projectId])
  @@index([projectId, isLatest])
  @@index([parentId])
}
```

## 3. Add the inverse relation on `User`

In your `User` model, add alongside the other relations:

```prisma
  documentsUploaded  Document[]         @relation("DocumentUploader")
```

## Why this shape

- **`parentId` / `versions`**: v1 of a file is uploaded with `parentId: null`.
  Every subsequent version is a *new row* with `parentId` pointing at v1,
  and `version` incremented. This gives you full revision history for free
  (`prisma.document.findMany({ where: { parentId: rootId } })`) without a
  separate audit table.
- **`isLatest`**: denormalized flag, flipped in a transaction whenever a new
  version is uploaded, so listing "current documents" for a project is a
  single indexed query instead of a window function.
- **`deletedAt`**: soft delete. Architectural documents should never
  hard-delete — if someone removes a drawing by mistake, Take Over Project
  and audit history still need to reference it.
- **`uploadedBy` relation**: lets the UI show "Uploaded by Naomi Otieno"
  without a second lookup, and lets you query "documents uploaded by user X"
  directly.
