import { db } from "@/lib/db";
import { auditLog } from "@/lib/db/schema";

interface AuditEntry {
  memberId?: string | null;
  action: string;
  entityType?: string;
  entityId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
}

export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    await db.insert(auditLog).values({
      memberId: entry.memberId || null,
      action: entry.action,
      entityType: entry.entityType || null,
      entityId: entry.entityId || null,
      details: entry.details ? JSON.stringify(entry.details) : null,
      ipAddress: entry.ipAddress || null,
    });
  } catch (error) {
    console.error("Audit-Log Fehler:", error);
  }
}
