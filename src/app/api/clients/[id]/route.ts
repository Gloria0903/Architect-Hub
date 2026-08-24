import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { canManageClients, isAdmin } from "@/lib/rbac";
import { z } from "zod";

const UpdateSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Client name must be at least 2 characters")
      .optional(),

    contactPerson: z
      .string()
      .trim()
      .min(2, "Contact person must be at least 2 characters")
      .optional(),

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
  })
  .refine(
    (data) => Object.keys(data).length > 0,
    {
      message: "At least one field must be provided for update.",
    }
  );

const SafeClientSelect = {
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
} as const;

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
      { error: "Forbidden" },
      { status: 403 }
    );
  }

  const { id } = await params;

  if (!id) {
    return NextResponse.json(
      { error: "Client ID is required." },
      { status: 400 }
    );
  }

  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON request body." },
      { status: 400 }
    );
  }

  const parsed = UpdateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data = parsed.data;

  try {
    /*
     * Explicitly select safe fields.
     *
     * passwordHash is never returned from this endpoint.
     */
    const client = await prisma.client.update({
      where: { id },

      data: {
        ...(data.name !== undefined && {
          name: data.name,
        }),

        ...(data.contactPerson !== undefined && {
          contactPerson: data.contactPerson,
        }),

        ...(data.email !== undefined && {
          email: data.email || null,
        }),

        ...(data.phone !== undefined && {
          phone: data.phone || null,
        }),

        ...(data.address !== undefined && {
          address: data.address || null,
        }),
      },

      select: SafeClientSelect,
    });

    return NextResponse.json(client);
  } catch (error) {
    console.error(
      `Failed to update client ${id}:`,
      error
    );

    /*
     * Prisma P2025 = record not found.
     */
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2025"
    ) {
      return NextResponse.json(
        { error: "Client not found." },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        error:
          "Failed to update client. Please try again.",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();

  if (!session) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  /*
   * Client deletion is ADMIN ONLY.
   */
  if (!isAdmin(session)) {
    return NextResponse.json(
      { error: "Forbidden" },
      { status: 403 }
    );
  }

  const { id } = await params;

  if (!id) {
    return NextResponse.json(
      { error: "Client ID is required." },
      { status: 400 }
    );
  }

  try {
    /*
     * Do not allow deletion while projects still belong
     * to this client.
     */
    const projectCount = await prisma.project.count({
      where: {
        clientId: id,
      },
    });

    if (projectCount > 0) {
      return NextResponse.json(
        {
          error:
            "Cannot delete a client with existing projects. Delete or reassign their projects first.",
        },
        { status: 409 }
      );
    }

    /*
     * Also block deletion if there are comment/communication records
     * tied to this client -- ClientComment.clientId doesn't cascade on
     * delete (correctly: those records should outlive the client if
     * the client's projects are still around), so a raw delete would
     * otherwise fail with a generic error instead of this clear one.
     */
    const commentCount = await prisma.clientComment.count({
      where: { clientId: id },
    });

    if (commentCount > 0) {
      return NextResponse.json(
        {
          error:
            "Cannot delete a client with existing communication records. Those need to be cleared first.",
        },
        { status: 409 }
      );
    }

    /*
     * Verify the client exists before deletion.
     */
    const client = await prisma.client.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!client) {
      return NextResponse.json(
        { error: "Client not found." },
        { status: 404 }
      );
    }

    await prisma.client.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error(
      `Failed to delete client ${id}:`,
      error
    );

    return NextResponse.json(
      {
        error:
          "Failed to delete client. Please try again.",
      },
      { status: 500 }
    );
  }
}