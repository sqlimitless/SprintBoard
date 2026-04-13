import { and, asc, desc, eq, isNotNull, isNull } from "drizzle-orm";
import {
  cleanupRemovedAttachments,
  deleteAttachmentsByScope,
} from "../attachments";
import * as audit from "./audit.repo";
import { newId, nowIso, orm } from "./connection";
import { change_log, issues, projects } from "./schema";
import type { Project } from "./types";

export async function listProjects(): Promise<Project[]> {
  const rows = await orm
    .select()
    .from(projects)
    .where(isNull(projects.deleted_at))
    .orderBy(asc(projects.sort_order), asc(projects.created_at));
  return rows as Project[];
}

export async function listDeletedProjects(): Promise<Project[]> {
  const rows = await orm
    .select()
    .from(projects)
    .where(isNotNull(projects.deleted_at))
    .orderBy(desc(projects.deleted_at));
  return rows as Project[];
}

export async function getProject(id: string): Promise<Project | null> {
  const rows = await orm
    .select()
    .from(projects)
    .where(and(eq(projects.id, id), isNull(projects.deleted_at)))
    .limit(1);
  return (rows[0] as Project | undefined) ?? null;
}

export async function listAllKeys(): Promise<string[]> {
  const rows = await orm.select({ key: projects.key }).from(projects);
  return rows.map((r) => r.key as string);
}

export async function createProject(input: {
  key: string;
  name: string;
  description?: string;
  status?: Project["status"];
}): Promise<Project> {
  const now = nowIso();
  const row: Project = {
    id: newId(),
    key: input.key.trim().toUpperCase(),
    name: input.name.trim(),
    description: input.description ?? "",
    status: input.status ?? "active",
    sort_order: Date.now(),
    created_at: now,
    updated_at: now,
    deleted_at: null,
  };
  await orm.insert(projects).values(row);
  await audit.log({
    entity_type: "project",
    entity_id: row.id,
    action: "create",
    changes: { snapshot: { key: row.key, name: row.name, status: row.status } },
  });
  return row;
}

export async function updateProject(
  id: string,
  patch: Partial<Pick<Project, "name" | "description" | "key" | "status">>,
): Promise<void> {
  const rows = await orm
    .select()
    .from(projects)
    .where(eq(projects.id, id))
    .limit(1);
  const before = rows[0] as Project | undefined;
  if (!before) return;

  const normalized: Partial<Project> = {};
  if (patch.name !== undefined) normalized.name = patch.name.trim();
  if (patch.description !== undefined) normalized.description = patch.description;
  if (patch.key !== undefined)
    normalized.key = patch.key.trim().toUpperCase();
  if (patch.status !== undefined) normalized.status = patch.status;

  await orm
    .update(projects)
    .set({ ...normalized, updated_at: nowIso() })
    .where(eq(projects.id, id));

  if (normalized.description !== undefined) {
    await cleanupRemovedAttachments(
      before.description ?? "",
      normalized.description,
    );
  }

  const changes = audit.diff(
    before as unknown as Record<string, unknown>,
    normalized as Record<string, unknown>,
  );
  if (Object.keys(changes).length > 0) {
    await audit.log({
      entity_type: "project",
      entity_id: id,
      action: "update",
      changes,
    });
  }
}

export async function deleteProject(id: string): Promise<void> {
  const now = nowIso();
  // Cascade soft-delete: mark all active issues under this project
  // with the same timestamp so restore can reverse them cleanly.
  await orm
    .update(issues)
    .set({ deleted_at: now, updated_at: now })
    .where(and(eq(issues.project_id, id), isNull(issues.deleted_at)));
  await orm
    .update(projects)
    .set({ deleted_at: now, updated_at: now })
    .where(eq(projects.id, id));
  await audit.log({
    entity_type: "project",
    entity_id: id,
    action: "delete",
  });
}

export async function restoreProject(id: string): Promise<void> {
  // Find the project's deleted_at to restore issues cascaded at the same time.
  const rows = await orm
    .select()
    .from(projects)
    .where(eq(projects.id, id))
    .limit(1);
  const before = rows[0] as Project | undefined;
  if (!before) return;

  const now = nowIso();
  if (before.deleted_at) {
    await orm
      .update(issues)
      .set({ deleted_at: null, updated_at: now })
      .where(
        and(
          eq(issues.project_id, id),
          eq(issues.deleted_at, before.deleted_at),
        ),
      );
  }
  await orm
    .update(projects)
    .set({ deleted_at: null, updated_at: now })
    .where(eq(projects.id, id));
  await audit.log({
    entity_type: "project",
    entity_id: id,
    action: "restore",
  });
}

// Permanent removal. Also strips the matching change_log entries; ON DELETE
// CASCADE on the issues table takes care of every descendant issue row.
export async function purgeProject(id: string): Promise<void> {
  const issueRows = await orm
    .select({ id: issues.id })
    .from(issues)
    .where(eq(issues.project_id, id));
  for (const r of issueRows) {
    await orm
      .delete(change_log)
      .where(
        and(
          eq(change_log.entity_type, "issue"),
          eq(change_log.entity_id, r.id as string),
        ),
      );
  }
  await orm
    .delete(change_log)
    .where(
      and(eq(change_log.entity_type, "project"), eq(change_log.entity_id, id)),
    );
  await orm.delete(projects).where(eq(projects.id, id));
  // Remove every image stored under attachments/<projectId>/.
  await deleteAttachmentsByScope(id);
}
