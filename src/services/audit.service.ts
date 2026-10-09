import prisma from "../lib/prisma";

interface CreateAuditLogParams {
  userId: string;
  action: string;
  entity?: string;
  entityId?: string;
  details?: string;
}

export const createAuditLog = async ({
  userId,
  action,
  entity,
  entityId,
  details,
}: CreateAuditLogParams) => {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        action,
        entity,
        entityId,
        details,
      },
    });
  } catch (error) {
    console.error("CREATE AUDIT LOG ERROR:", error);
  }
};