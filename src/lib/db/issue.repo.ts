import { and, asc, desc, eq, inArray, isNotNull, isNull, max } from "drizzle-orm";
import {
  cleanupRemovedAttachments,
  deleteAttachmentByUrl,
  extractAttachmentUrls,
} from "../attachments";
import * as audit from "./audit.repo";
import { newId, nowIso, orm } from "./connection";
import { change_log, issues } from "./schema";
import type { Issue, IssueStatus, IssueType, Priority } from "./types";

export type CreateIssueInput = {
  project_id: string;
  type: IssueType;
  parent_id: string | null;
  title: string;
  description?: string;
  status?: IssueStatus;
  priority?: Priority;
};

export async function createIssue(input: CreateIssueInput): Promise<Issue> {
  validateHierarchy(input.type, input.parent_id);

  const now = nowIso();
  const status: IssueStatus = input.status ?? "backlog";
  const [{ maxOrder }] = await orm
    .select({ maxOrder: max(issues.sort_order) })
    .from(issues)
    .where(
      and(
        eq(issues.project_id, input.project_id),
        eq(issues.type, input.type),
        eq(issues.status, status),
        isNull(issues.deleted_at),
      ),
    );

  const row: Issue = {
    id: newId(),
    project_id: input.project_id,
    type: input.type,
    parent_id: input.parent_id,
    title: input.title.trim(),
    description: input.description ?? "",
    status,
    priority: input.priority ?? "medium",
    sort_order: ((maxOrder as number | null) ?? -1) + 1,
    sprint_id: null,
    start_date: null,
    due_date: null,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  };
  await orm.insert(issues).values(row);
  await audit.log({
    entity_type: "issue",
    entity_id: row.id,
    action: "create",
    changes: {
      snapshot: {
        type: row.type,
        title: row.title,
        status: row.status,
        priority: row.priority,
        parent_id: row.parent_id,
      },
    },
  });
  return row;
}

function validateHierarchy(type: IssueType, parentId: string | null) {
  if (type === "epic" && parentId !== null) {
    throw new Error("Epic은 부모를 가질 수 없습니다");
  }
  if ((type === "story" || type === "task") && !parentId) {
    throw new Error(`${type}는 부모가 필요합니다`);
  }
}

export async function getIssue(id: string): Promise<Issue | null> {
  const rows = await orm
    .select()
    .from(issues)
    .where(and(eq(issues.id, id), isNull(issues.deleted_at)))
    .limit(1);
  return (rows[0] as Issue | undefined) ?? null;
}

export async function listEpics(projectId: string): Promise<Issue[]> {
  const rows = await orm
    .select()
    .from(issues)
    .where(
      and(
        eq(issues.project_id, projectId),
        eq(issues.type, "epic"),
        isNull(issues.deleted_at),
      ),
    )
    .orderBy(asc(issues.sort_order), asc(issues.created_at));
  return rows as Issue[];
}

export async function listChildren(parentId: string): Promise<Issue[]> {
  const rows = await orm
    .select()
    .from(issues)
    .where(and(eq(issues.parent_id, parentId), isNull(issues.deleted_at)))
    .orderBy(asc(issues.status), asc(issues.sort_order));
  return rows as Issue[];
}

export async function listDeletedIssues(): Promise<Issue[]> {
  const rows = await orm
    .select()
    .from(issues)
    .where(isNotNull(issues.deleted_at))
    .orderBy(desc(issues.deleted_at));
  return rows as Issue[];
}

export type IssuePatch = Partial<
  Pick<
    Issue,
    | "title"
    | "description"
    | "status"
    | "priority"
    | "sort_order"
    | "start_date"
    | "due_date"
    | "sprint_id"
  >
>;

export async function updateIssue(id: string, patch: IssuePatch): Promise<void> {
  const rows = await orm
    .select()
    .from(issues)
    .where(eq(issues.id, id))
    .limit(1);
  const before = rows[0] as Issue | undefined;
  if (!before) return;

  const update: Record<string, unknown> = { updated_at: nowIso() };
  const applied: Record<string, unknown> = {};
  if (patch.title !== undefined) {
    update.title = patch.title;
    applied.title = patch.title;
  }
  if (patch.description !== undefined) {
    update.description = patch.description;
    applied.description = patch.description;
    await cleanupRemovedAttachments(
      before.description ?? "",
      patch.description,
    );
  }
  if (patch.status !== undefined) {
    update.status = patch.status;
    applied.status = patch.status;
  }
  if (patch.priority !== undefined) {
    update.priority = patch.priority;
    applied.priority = patch.priority;
  }
  if (patch.sort_order !== undefined) {
    update.sort_order = patch.sort_order;
    applied.sort_order = patch.sort_order;
  }
  if (patch.start_date !== undefined) {
    update.start_date = patch.start_date;
    applied.start_date = patch.start_date;
  }
  if (patch.due_date !== undefined) {
    update.due_date = patch.due_date;
    applied.due_date = patch.due_date;
  }
  if (patch.sprint_id !== undefined) {
    update.sprint_id = patch.sprint_id;
    applied.sprint_id = patch.sprint_id;
  }
  await orm.update(issues).set(update).where(eq(issues.id, id));

  const changes = audit.diff(
    before as unknown as Record<string, unknown>,
    applied,
  );
  // Skip noise-only changes (sort_order-only) from audit feed.
  const nonNoise = Object.keys(changes).filter((k) => k !== "sort_order");
  if (nonNoise.length > 0) {
    await audit.log({
      entity_type: "issue",
      entity_id: id,
      action: "update",
      changes,
    });
  }
}

export async function moveIssue(
  id: string,
  status: IssueStatus,
  sortOrder: number,
): Promise<void> {
  const rows = await orm
    .select()
    .from(issues)
    .where(eq(issues.id, id))
    .limit(1);
  const before = rows[0] as Issue | undefined;
  await orm
    .update(issues)
    .set({ status, sort_order: sortOrder, updated_at: nowIso() })
    .where(eq(issues.id, id));
  if (before && before.status !== status) {
    await audit.log({
      entity_type: "issue",
      entity_id: id,
      action: "update",
      changes: { status: [before.status, status] },
    });
  }
}

export async function deleteIssue(id: string): Promise<void> {
  const now = nowIso();
  await cascadeSoftDelete(id, now);
}

async function cascadeSoftDelete(id: string, now: string): Promise<void> {
  const children = await orm
    .select({ id: issues.id })
    .from(issues)
    .where(and(eq(issues.parent_id, id), isNull(issues.deleted_at)));
  for (const c of children) await cascadeSoftDelete(c.id as string, now);
  await orm
    .update(issues)
    .set({ deleted_at: now, updated_at: now })
    .where(eq(issues.id, id));
  await audit.log({
    entity_type: "issue",
    entity_id: id,
    action: "delete",
  });
}

export async function restoreIssue(id: string): Promise<void> {
  const rows = await orm
    .select()
    .from(issues)
    .where(eq(issues.id, id))
    .limit(1);
  const before = rows[0] as Issue | undefined;
  if (!before) return;

  const now = nowIso();
  if (before.deleted_at) {
    await cascadeRestore(id, before.deleted_at, now);
  } else {
    await orm
      .update(issues)
      .set({ deleted_at: null, updated_at: now })
      .where(eq(issues.id, id));
  }
  await audit.log({
    entity_type: "issue",
    entity_id: id,
    action: "restore",
  });
}

// Only restore descendants whose deleted_at matches the parent's — otherwise
// a previously-deleted child would be resurrected unexpectedly.
async function cascadeRestore(
  id: string,
  deletedAt: string,
  now: string,
): Promise<void> {
  await orm
    .update(issues)
    .set({ deleted_at: null, updated_at: now })
    .where(eq(issues.id, id));
  const children = await orm
    .select({ id: issues.id })
    .from(issues)
    .where(and(eq(issues.parent_id, id), eq(issues.deleted_at, deletedAt)));
  for (const c of children) await cascadeRestore(c.id as string, deletedAt, now);
}

// Permanent delete. FK `ON DELETE CASCADE` on issues.parent_id removes all
// descendant issue rows for us; we strip matching change_log entries first,
// and also delete any attachment files referenced in their descriptions.
export async function purgeIssue(id: string): Promise<void> {
  const descendantIds = await collectDescendantIds(id);
  const allIds = [id, ...descendantIds];

  // Collect attachment URLs from every affected issue description.
  const rows = await orm
    .select({ id: issues.id, description: issues.description })
    .from(issues)
    .where(eq(issues.id, id));
  const descendantRows =
    descendantIds.length > 0
      ? await Promise.all(
          descendantIds.map((did) =>
            orm
              .select({ id: issues.id, description: issues.description })
              .from(issues)
              .where(eq(issues.id, did))
              .limit(1)
              .then((r) => r[0]),
          ),
        )
      : [];
  const allRows = [...rows, ...descendantRows].filter(Boolean) as {
    id: string;
    description: string;
  }[];

  const urls = new Set<string>();
  for (const r of allRows) {
    for (const u of extractAttachmentUrls(r.description ?? "")) urls.add(u);
  }
  for (const u of urls) await deleteAttachmentByUrl(u);

  for (const did of allIds) {
    await orm
      .delete(change_log)
      .where(
        and(
          eq(change_log.entity_type, "issue"),
          eq(change_log.entity_id, did),
        ),
      );
  }
  await orm.delete(issues).where(eq(issues.id, id));
}

// Stories directly attached to the sprint, plus all their (live) task children.
export async function listBySprint(sprintId: string): Promise<{
  stories: Issue[];
  tasks: Issue[];
}> {
  const stories = (await orm
    .select()
    .from(issues)
    .where(
      and(
        eq(issues.sprint_id, sprintId),
        eq(issues.type, "story"),
        isNull(issues.deleted_at),
      ),
    )
    .orderBy(asc(issues.sort_order), asc(issues.created_at))) as Issue[];

  if (stories.length === 0) return { stories: [], tasks: [] };

  const storyIds = stories.map((s) => s.id);
  const tasks = (await orm
    .select()
    .from(issues)
    .where(
      and(
        inArray(issues.parent_id, storyIds),
        eq(issues.type, "task"),
        isNull(issues.deleted_at),
      ),
    )
    .orderBy(asc(issues.status), asc(issues.sort_order))) as Issue[];

  return { stories, tasks };
}

// All live stories in a project, regardless of sprint assignment. Used by
// the backlog planning view to arrange stories across sprints + backlog.
export async function listStoriesByProject(projectId: string): Promise<Issue[]> {
  const rows = await orm
    .select()
    .from(issues)
    .where(
      and(
        eq(issues.project_id, projectId),
        eq(issues.type, "story"),
        isNull(issues.deleted_at),
      ),
    )
    .orderBy(asc(issues.sort_order), asc(issues.created_at));
  return rows as Issue[];
}

// Stories for an epic that are not assigned to any sprint.
export async function listUnassignedStories(epicId: string): Promise<Issue[]> {
  const rows = await orm
    .select()
    .from(issues)
    .where(
      and(
        eq(issues.parent_id, epicId),
        eq(issues.type, "story"),
        isNull(issues.sprint_id),
        isNull(issues.deleted_at),
      ),
    )
    .orderBy(asc(issues.sort_order));
  return rows as Issue[];
}

export async function assignSprint(
  storyId: string,
  sprintId: string | null,
): Promise<void> {
  await orm
    .update(issues)
    .set({ sprint_id: sprintId, updated_at: nowIso() })
    .where(eq(issues.id, storyId));
}

async function collectDescendantIds(parentId: string): Promise<string[]> {
  const children = await orm
    .select({ id: issues.id })
    .from(issues)
    .where(eq(issues.parent_id, parentId));
  const ids: string[] = [];
  for (const c of children) {
    const cid = c.id as string;
    ids.push(cid);
    ids.push(...(await collectDescendantIds(cid)));
  }
  return ids;
}
