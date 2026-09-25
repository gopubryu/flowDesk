import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { AuditEvent } from "./audit-events";

export async function recordAuditEvent(event: AuditEvent): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        workspaceId: event.workspaceId,
        actorUserId: event.actorUserId,
        action: event.action,
        resourceType: event.resourceType,
        resourceId: event.resourceId,
        resourceCode: event.resourceCode,
        before: event.before === null ? Prisma.JsonNull : event.before,
        after: event.after === null ? Prisma.JsonNull : event.after,
        reason: event.reason,
        requestId: event.requestId,
        ip: event.ip,
        userAgent: event.userAgent,
      },
    });
  } catch (error) {
    // Audit persistence must remain observable without turning a successful
    // business mutation into an unexplained 500 while this feature rolls out.
    console.error("audit event persistence failed", error);
  }
}
