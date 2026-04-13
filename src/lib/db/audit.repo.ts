import { and, desc, eq } from "drizzle-orm";
import { newId, nowIso, orm } from "./connection";
import { change_log } from "./schema";
import type {
  AuditAction,
  AuditEntityType,
  AuditEntry,
} from "./types";

export async function log(input: {
  entity_type: AuditEntityType;
  entity_id: string;
  action: AuditAction;
  changes?: Record<string, unknown>;
}): Promise<void> {
  await orm.insert(change_log).values({
    id: newId(),
    entity_type: input.entity_type,
    entity_id: input.entity_id,
    action: input.action,
    changes: JSON.stringify(input.changes ?? {}),
    created_at: nowIso(),
  });
}

export async function listByEntity(
  entity_type: AuditEntityType,
  entity_id: string,
): Promise<AuditEntry[]> {
  const rows = await orm
    .select()
    .from(change_log)
    .where(
      and(
        eq(change_log.entity_type, entity_type),
        eq(change_log.entity_id, entity_id),
      ),
    )
    .orderBy(desc(change_log.created_at));
  return rows as AuditEntry[];
}

export function diff<T extends Record<string, unknown>>(
  before: T,
  after: Partial<T>,
): Record<string, [unknown, unknown]> {
  const out: Record<string, [unknown, unknown]> = {};
  for (const k of Object.keys(after)) {
    const a = before[k as keyof T];
    const b = after[k as keyof T];
    if (a !== b) out[k] = [a, b];
  }
  return out;
}
