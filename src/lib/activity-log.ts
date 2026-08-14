export async function logActivity({
  action,
  entityType,
  entityId,
  actorId,
  projectId,
  metadata,
}) {
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