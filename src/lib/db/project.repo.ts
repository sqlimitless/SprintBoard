import { and, asc, eq, isNull } from "drizzle-orm";
import { newId, nowIso, orm } from "./connection";
import { labels, projects, statuses } from "./schema";
import type { Label, Project, Status, StatusCategory } from "./types";

export type CreateProjectInput = {
  key: string;
  name: string;
  description?: string;
};

const DEFAULT_STATUSES: { name: string; category: StatusCategory }[] = [
  { name: "To Do", category: "todo" },
  { name: "In Progress", category: "in_progress" },
  { name: "Done", category: "done" },
];

export async function createProject(input: CreateProjectInput): Promise<Project> {
  const id = newId();
  const now = nowIso();

  await orm.insert(projects).values({
    id,
    key: input.key,
    name: input.name,
    description: input.description ?? "",
    issue_counter: 0,
    created_at: now,
    updated_at: now,
  });

  await orm.insert(statuses).values(
    DEFAULT_STATUSES.map((s, i) => ({
      id: newId(),
      project_id: id,
      name: s.name,
      category: s.category,
      sort_order: i,
      created_at: now,
      updated_at: now,
    })),
  );

  return (await getProjectById(id))!;
}

export async function getProjectById(id: string): Promise<Project | null> {
  const rows = await orm
    .select()
    .from(projects)
    .where(and(eq(projects.id, id), isNull(projects.deleted_at)))
    .limit(1);
  return (rows[0] as Project | undefined) ?? null;
}

export async function listProjects(): Promise<Project[]> {
  const rows = await orm
    .select()
    .from(projects)
    .where(isNull(projects.deleted_at))
    .orderBy(asc(projects.created_at));
  return rows as Project[];
}

export async function updateProject(
  id: string,
  patch: Partial<Pick<Project, "name" | "description" | "key">>,
): Promise<void> {
  await orm
    .update(projects)
    .set({ ...patch, updated_at: nowIso() })
    .where(eq(projects.id, id));
}

export async function softDeleteProject(id: string): Promise<void> {
  const now = nowIso();
  await orm
    .update(projects)
    .set({ deleted_at: now, updated_at: now })
    .where(eq(projects.id, id));
}

// ---------- statuses ----------

export async function listStatuses(projectId: string): Promise<Status[]> {
  const rows = await orm
    .select()
    .from(statuses)
    .where(and(eq(statuses.project_id, projectId), isNull(statuses.deleted_at)))
    .orderBy(asc(statuses.sort_order));
  return rows as Status[];
}

// ---------- labels ----------

export async function createLabel(
  projectId: string,
  name: string,
  color = "#888888",
): Promise<Label> {
  const id = newId();
  const now = nowIso();
  await orm.insert(labels).values({
    id,
    project_id: projectId,
    name,
    color,
    created_at: now,
    updated_at: now,
  });
  const rows = await orm.select().from(labels).where(eq(labels.id, id)).limit(1);
  return rows[0] as Label;
}

export async function listLabels(projectId: string): Promise<Label[]> {
  const rows = await orm
    .select()
    .from(labels)
    .where(and(eq(labels.project_id, projectId), isNull(labels.deleted_at)))
    .orderBy(asc(labels.name));
  return rows as Label[];
}
