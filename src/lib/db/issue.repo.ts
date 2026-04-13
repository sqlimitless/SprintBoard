import { and, asc, eq, isNull, max, sql } from "drizzle-orm";
import { newId, nowIso, orm } from "./connection";
import { comments, issue_labels, issues, projects } from "./schema";
import type { Comment, Issue, IssueType, Priority } from "./types";

export type CreateIssueInput = {
  project_id: string;
  type: IssueType;
  summary: string;
  description?: string;
  status_id: string;
  priority?: Priority;
  parent_id?: string | null;
  sprint_id?: string | null;
  assignee?: string | null;
  reporter?: string | null;
  story_points?: number | null;
  due_date?: string | null;
};

export async function createIssue(input: CreateIssueInput): Promise<Issue> {
  const id = newId();
  const now = nowIso();

  // 프로젝트 카운터 증가 + 키 조회를 단일 문장으로 원자적 처리 (UPDATE ... RETURNING).
  const bumped = await orm
    .update(projects)
    .set({
      issue_counter: sql`${projects.issue_counter} + 1`,
      updated_at: now,
    })
    .where(eq(projects.id, input.project_id))
    .returning({
      counter: projects.issue_counter,
      project_key: projects.key,
    });

  if (bumped.length === 0) {
    throw new Error(`Project not found: ${input.project_id}`);
  }
  const { counter, project_key } = bumped[0];
  const issueKey = `${project_key}-${counter}`;

  // 같은 상태 컬럼 내 최상단 뒤에 배치
  const [{ maxOrder }] = await orm
    .select({ maxOrder: max(issues.sort_order) })
    .from(issues)
    .where(and(eq(issues.status_id, input.status_id), isNull(issues.deleted_at)));

  await orm.insert(issues).values({
    id,
    project_id: input.project_id,
    key: issueKey,
    type: input.type,
    summary: input.summary,
    description: input.description ?? "",
    status_id: input.status_id,
    priority: input.priority ?? "medium",
    parent_id: input.parent_id ?? null,
    sprint_id: input.sprint_id ?? null,
    assignee: input.assignee ?? null,
    reporter: input.reporter ?? null,
    story_points: input.story_points ?? null,
    sort_order: (maxOrder ?? -1) + 1,
    due_date: input.due_date ?? null,
    created_at: now,
    updated_at: now,
  });

  return (await getIssueById(id))!;
}

export async function getIssueById(id: string): Promise<Issue | null> {
  const rows = await orm
    .select()
    .from(issues)
    .where(and(eq(issues.id, id), isNull(issues.deleted_at)))
    .limit(1);
  return (rows[0] as Issue | undefined) ?? null;
}

export async function getIssueByKey(key: string): Promise<Issue | null> {
  const rows = await orm
    .select()
    .from(issues)
    .where(and(eq(issues.key, key), isNull(issues.deleted_at)))
    .limit(1);
  return (rows[0] as Issue | undefined) ?? null;
}

export async function listIssuesInSprint(sprintId: string): Promise<Issue[]> {
  const rows = await orm
    .select()
    .from(issues)
    .where(and(eq(issues.sprint_id, sprintId), isNull(issues.deleted_at)))
    .orderBy(asc(issues.sort_order));
  return rows as Issue[];
}

export async function listBacklog(projectId: string): Promise<Issue[]> {
  const rows = await orm
    .select()
    .from(issues)
    .where(
      and(
        eq(issues.project_id, projectId),
        isNull(issues.sprint_id),
        isNull(issues.deleted_at),
      ),
    )
    .orderBy(asc(issues.sort_order));
  return rows as Issue[];
}

export async function listSubIssues(parentId: string): Promise<Issue[]> {
  const rows = await orm
    .select()
    .from(issues)
    .where(and(eq(issues.parent_id, parentId), isNull(issues.deleted_at)))
    .orderBy(asc(issues.sort_order));
  return rows as Issue[];
}

export type IssuePatch = Partial<
  Pick<
    Issue,
    | "summary"
    | "description"
    | "status_id"
    | "priority"
    | "parent_id"
    | "sprint_id"
    | "assignee"
    | "reporter"
    | "story_points"
    | "sort_order"
    | "due_date"
    | "type"
  >
>;

export async function updateIssue(id: string, patch: IssuePatch): Promise<void> {
  await orm
    .update(issues)
    .set({ ...patch, updated_at: nowIso() })
    .where(eq(issues.id, id));
}

export async function moveIssue(
  id: string,
  statusId: string,
  sortOrder: number,
): Promise<void> {
  await orm
    .update(issues)
    .set({ status_id: statusId, sort_order: sortOrder, updated_at: nowIso() })
    .where(eq(issues.id, id));
}

export async function softDeleteIssue(id: string): Promise<void> {
  const now = nowIso();
  await orm
    .update(issues)
    .set({ deleted_at: now, updated_at: now })
    .where(eq(issues.id, id));
}

// ---------- labels attach ----------

export async function attachLabel(issueId: string, labelId: string): Promise<void> {
  await orm
    .insert(issue_labels)
    .values({ issue_id: issueId, label_id: labelId })
    .onConflictDoNothing();
}

export async function detachLabel(issueId: string, labelId: string): Promise<void> {
  await orm
    .delete(issue_labels)
    .where(
      and(
        eq(issue_labels.issue_id, issueId),
        eq(issue_labels.label_id, labelId),
      ),
    );
}

// ---------- comments ----------

export async function addComment(
  issueId: string,
  body: string,
  author: string | null = null,
): Promise<Comment> {
  const id = newId();
  const now = nowIso();
  await orm.insert(comments).values({
    id,
    issue_id: issueId,
    author,
    body,
    created_at: now,
    updated_at: now,
  });
  const rows = await orm
    .select()
    .from(comments)
    .where(eq(comments.id, id))
    .limit(1);
  return rows[0] as Comment;
}

export async function listComments(issueId: string): Promise<Comment[]> {
  const rows = await orm
    .select()
    .from(comments)
    .where(and(eq(comments.issue_id, issueId), isNull(comments.deleted_at)))
    .orderBy(asc(comments.created_at));
  return rows as Comment[];
}

export async function softDeleteComment(id: string): Promise<void> {
  const now = nowIso();
  await orm
    .update(comments)
    .set({ deleted_at: now, updated_at: now })
    .where(eq(comments.id, id));
}
