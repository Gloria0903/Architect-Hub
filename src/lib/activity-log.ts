import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

interface LogActivityInput {
  action: string;
  entityType: string;
  entityId: string;
  actorId: string;
  projectId?: string | null;
  metadata?: Prisma.InputJsonValue;
}

export async function logActivity({
  action,
  entityType,
  entityId,
  actorId,
  projectId,
  metadata,
}: LogActivityInput) {
  return prisma.activityLog.create({
    data: {
      action,
      entityType,
      entityId,
      actorId,
      projectId,
      metadata,
    },
  });
}