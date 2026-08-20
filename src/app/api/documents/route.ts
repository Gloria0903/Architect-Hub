import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { isAdmin, canAccessProject } from "@/lib/rbac";
import { saveUploadedFile } from "@/lib/storage";
import {
  validateDocumentUpload,
  sniffDangerousSignature,
} from "@/lib/document-validation";
import { notifyDocumentUploaded } from "@/lib/notifications";

export async function GET(req: NextRequest) {
  const session = await auth();

  if (!session) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");

  const documents = await prisma.document.findMany({
    where: {
      ...(projectId && { projectId }),

      isLatest: true,
      deletedAt: null,

      ...(!isAdmin(session) && {
        project: {
          OR: [
            {
              architectId: session.user.id,
            },
            {
              supervisorId: session.user.id,
            },
          ],
        },
      }),
    },

    include: {
      project: {
        select: {
          id: true,
          name: true,
          sheetNo: true,
        },
      },

      uploadedBy: {
        select: {
          id: true,
          name: true,
          initials: true,
          avatarUrl: true,
        },
      },
    },

    orderBy: {
      uploadedAt: "desc",
    },
  });

  return NextResponse.json(documents);
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();

    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const formData = await req.formData();

    const file = formData.get("file");
    const projectId = formData.get("projectId");
    const category = formData.get("category");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "No file provided." },
        { status: 400 }
      );
    }

    if (
      typeof projectId !== "string" ||
      !projectId
    ) {
      return NextResponse.json(
        {
          error:
            "A project must be selected before uploading.",
        },
        { status: 400 }
      );
    }

    /*
     * Layer 1:
     *
     * Validate the declared MIME type, extension and file size.
     *
     * The validator deliberately supports application/octet-stream
     * for legitimate CAD/BIM files whose MIME types browsers cannot
     * reliably determine.
     */
    const declaredCheck =
      validateDocumentUpload({
        fileName: file.name,
        mimeType:
          file.type ||
          "application/octet-stream",
        sizeBytes: file.size,
      });

    if (!declaredCheck.ok) {
      return NextResponse.json(
        {
          error:
            declaredCheck.error ??
            "Unsupported file type.",
        },
        { status: 400 }
      );
    }

    /*
     * Read the file once so the actual bytes can be inspected before
     * saving anything to storage.
     */
    const buffer = Buffer.from(
      await file.arrayBuffer()
    );

    /*
     * Layer 2:
     *
     * Inspect the actual file signature.
     *
     * This protects against somebody renaming:
     *
     * malicious.exe -> drawing.pdf
     *
     * or:
     *
     * malicious.exe -> project.dwg
     */
    const sniffed =
      sniffDangerousSignature(buffer);

    if (sniffed.dangerous) {
      return NextResponse.json(
        {
          error:
            `This file's content looks like a ` +
            `${sniffed.label}, which isn't an allowed ` +
            "project document.",
        },
        { status: 400 }
      );
    }

    /*
     * Verify the project exists.
     */
    const project =
      await prisma.project.findUnique({
        where: {
          id: projectId,
        },
      });

    if (!project) {
      return NextResponse.json(
        {
          error: "Project not found.",
        },
        { status: 404 }
      );
    }

    /*
     * Verify the current user is allowed to access
     * this project.
     */
    if (!canAccessProject(session, project)) {
      return NextResponse.json(
        {
          error: "Forbidden.",
        },
        { status: 403 }
      );
    }

    /*
     * Keep categories controlled.
     */
    const validCategories = [
      "DRAWING",
      "BOQ",
      "CONTRACT",
      "SITE_REPORT",
      "PRESENTATION",
      "OTHER",
    ];

    const resolvedCategory =
      typeof category === "string" &&
      validCategories.includes(category)
        ? category
        : "OTHER";

    /*
     * Save the actual file.
     */
    const {
      fileKey,
      fileSize,
    } = await saveUploadedFile(
      file,
      buffer
    );

    /*
     * Create the document record.
     */
    const document =
      await prisma.document.create({
        data: {
          name: file.name,

          category:
            resolvedCategory as never,

          fileKey,

          /*
           * The actual download endpoint is generated
           * immediately below.
           */
          fileUrl:
            "/api/documents/placeholder",

          fileSize,

          mimeType:
            file.type ||
            "application/octet-stream",

          projectId,

          uploadedById:
            session.user.id,
        },

        include: {
          project: {
            select: {
              id: true,
              name: true,
              sheetNo: true,
            },
          },

          uploadedBy: {
            select: {
              id: true,
              name: true,
              initials: true,
              avatarUrl: true,
            },
          },
        },
      });

    /*
     * Point the document at its real download endpoint.
     */
    const updated =
      await prisma.document.update({
        where: {
          id: document.id,
        },

        data: {
          fileUrl:
            `/api/documents/${document.id}`,
        },

        include: {
          project: {
            select: {
              id: true,
              name: true,
              sheetNo: true,
            },
          },

          uploadedBy: {
            select: {
              id: true,
              name: true,
              initials: true,
              avatarUrl: true,
            },
          },
        },
      });

    /*
     * Notify the project architect/supervisor.
     */
    const notifyRecipients = [
      project.architectId,
      project.supervisorId,
    ].filter(
      (
        uid
      ): uid is string =>
        Boolean(uid) &&
        uid !== session.user.id
    );

    await Promise.all(
      [...new Set(notifyRecipients)].map(
        (userId) =>
          notifyDocumentUploaded({
            userId,
            projectId: project.id,
            projectName:
              `${project.name} (${project.sheetNo})`,
            documentName: file.name,
            uploadedByName:
              session.user.name ??
              "A team member",
          })
      )
    );

    return NextResponse.json(
      updated,
      {
        status: 201,
      }
    );
  } catch (error) {
    console.error(
      "Document upload failed:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Document upload failed. Please try again.",
      },
      {
        status: 500,
      }
    );
  }
}