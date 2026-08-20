import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { canManageClients, isAdmin } from "@/lib/rbac";
import { z } from "zod";

const Schema = z.object({
  name: z.string().trim().min(2, "Client name is required"),

  contactPerson: z
    .string()
    .trim()
    .min(2, "Contact person is required"),

  email: z
    .string()
    .trim()
    .email("Invalid email address")
    .optional()
    .or(z.literal("")),

  phone: z
    .string()
    .trim()
    .optional(),

  address: z
    .string()
    .trim()
    .optional(),
});

/*
|--------------------------------------------------------------------------
| GET /api/clients
|--------------------------------------------------------------------------
|
| ADMIN:
| - Can see all clients.
| - Can see all projects belonging to those clients.
|
| ARCHITECT:
| - Can only see clients connected to projects where they are the
|   architect or supervisor.
| - Can only see the projects they are actually involved with.
|
| SECURITY:
| - passwordHash is NEVER selected.
| - Sensitive client credentials must never be returned by this endpoint.
|
|--------------------------------------------------------------------------
*/

export async function GET() {
  const session = await auth();

  if (!session) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const admin = isAdmin(session);

  /*
   * Non-admin users may only access clients attached to projects
   * where they are the architect or supervisor.
   */
  const projectScope = {
    OR: [
      {
        architectId: session.user.id,
      },
      {
        supervisorId: session.user.id,
      },
    ],
  };

  try {
    const clients = await prisma.client.findMany({
      where: admin
        ? {}
        : {
            projects: {
              some: projectScope,
            },
          },

      /*
       * Explicitly select safe client fields.
       *
       * IMPORTANT:
       * Do NOT use `client: true` or an unrestricted client selection.
       * passwordHash must never leave the database through this endpoint.
       */
      select: {
        id: true,
        name: true,
        contactPerson: true,
        email: true,
        phone: true,
        address: true,

        portalEnabled: true,
        createdAt: true,
        updatedAt: true,
        lastPortalLoginAt: true,

        projects: {
          where: admin
            ? undefined
            : projectScope,

          select: {
            id: true,
            sheetNo: true,
            name: true,
            status: true,
            progress: true,
          },

          orderBy: {
            createdAt: "desc",
          },
        },

        _count: {
          select: {
            projects: admin
              ? true
              : {
                  where: projectScope,
                },

            comments: true,
          },
        },
      },

      orderBy: {
        name: "asc",
      },
    });

    return NextResponse.json(clients);
  } catch (error) {
    console.error(
      "Failed to fetch clients:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Failed to load clients. Please try again.",
      },
      {
        status: 500,
      }
    );
  }
}

/*
|--------------------------------------------------------------------------
| POST /api/clients
|--------------------------------------------------------------------------
|
| ONLY ADMIN:
| - Can create clients.
|
| ARCHITECT:
| - Cannot create clients.
|
| SECURITY:
| - Authorization is enforced server-side.
| - Input is validated with Zod.
| - passwordHash is never returned.
|
|--------------------------------------------------------------------------
*/

export async function POST(req: NextRequest) {
  const session = await auth();

  if (!session) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  /*
   * Client management is ADMIN ONLY.
   */
  if (!canManageClients(session)) {
    return NextResponse.json(
      {
        error: "Forbidden",
      },
      {
        status: 403,
      }
    );
  }

  /*
   * Safely parse request body.
   */
  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      {
        error: "Invalid JSON request body",
      },
      {
        status: 400,
      }
    );
  }

  /*
   * Validate request body.
   */
  const parsed = Schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: parsed.error.flatten(),
      },
      {
        status: 400,
      }
    );
  }

  try {
    /*
     * Create client.
     *
     * We explicitly select the fields that may be returned to
     * the browser so that passwordHash can never accidentally
     * leak if the Prisma Client model changes.
     */
    const client = await prisma.client.create({
      data: {
        name: parsed.data.name,
        contactPerson: parsed.data.contactPerson,
        email: parsed.data.email || null,
        phone: parsed.data.phone || null,
        address: parsed.data.address || null,
      },

      select: {
        id: true,
        name: true,
        contactPerson: true,
        email: true,
        phone: true,
        address: true,
        portalEnabled: true,
        createdAt: true,
        updatedAt: true,
        lastPortalLoginAt: true,
      },
    });

    return NextResponse.json(
      client,
      {
        status: 201,
      }
    );
  } catch (error) {
    console.error(
      "Client creation failed:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Failed to create client. Please try again.",
      },
      {
        status: 500,
      }
    );
  }
}