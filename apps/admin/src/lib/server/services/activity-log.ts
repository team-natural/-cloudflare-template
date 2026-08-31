// Audit log writer (DEV-05 §9-1, DEV-07 §4-8). Called inline from Service functions that
// perform a "meaningful state transition" — never from a cross-cutting AuditLogService that
// re-derives what counts as loggable.
import type { DbClient } from "../db/client";
import { activityLog } from "@app/schema";

export interface ActivityLogEntry {
  logName?: string;
  description: string;
  subjectType?: string;
  subjectId?: number;
  event?: string;
  causerType?: string;
  // Omit for system-driven changes with no human actor (DEV-05 §9-1) — never invent a "system" AdminUser row.
  causerId?: number;
  properties?: Record<string, unknown>;
}

// Returns the un-executed insert so callers can include it in db.batch() (DEV-05 §3).
export function activityLogInsert(db: DbClient, entry: ActivityLogEntry) {
  return db.insert(activityLog).values({
    logName: entry.logName ?? null,
    description: entry.description,
    subjectType: entry.subjectType ?? null,
    subjectId: entry.subjectId ?? null,
    event: entry.event ?? null,
    causerType: entry.causerType ?? "AdminUser",
    causerId: entry.causerId ?? null,
    properties: entry.properties ? JSON.stringify(entry.properties) : null,
    batchId: null,
  });
}

export async function logActivity(db: DbClient, entry: ActivityLogEntry): Promise<void> {
  await activityLogInsert(db, entry);
}
