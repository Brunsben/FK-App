import { db } from "@/lib/db";
import { auditLog } from "@/lib/db/schema";
import { v4 as uuid } from "uuid";

interface AuditEntry {
  userId?: string;
  action: string;
  entityType?: string;
  entityId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
}

export function logAudit(entry: AuditEntry): void {
  try {
    db.insert(auditLog)
      .values({
        id: uuid(),
        userId: entry.userId || null,
        action: entry.action,
        entityType: entry.entityType || null,
        entityId: entry.entityId || null,
        details: entry.details ? JSON.stringify(entry.details) : null,
        ipAddress: entry.ipAddress || null,
      })
      .run();
  } catch (error) {
    console.error("Audit-Log Fehler:", error);
  }
}
