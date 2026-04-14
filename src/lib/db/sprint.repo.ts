import { and, asc, eq, isNull, max } from "drizzle-orm";
import { newId, nowIso, orm } from "./connection";
import { issues, sprints } from "./schema";
import type { Sprint, SprintState } from "./types";

export type CreateSprintInput = {
  project_id: string;
  name: string;
  goal?: string;
  start_date?: string | null;
  end_date?: string | null;
};

export async function createSprint(input: CreateSprintInput): Promise<Sprint> {
  const now = nowIso();
  const [{ maxOrder }] = await orm
    .select({ maxOrder: max(sprints.sort_order) })
    .from(sprints)
    .where(
      and(eq(sprints.project_id, input.project_id), isNull(sprints.deleted_at)),
    );

  const row: Sprint = {
    id: newId(),
    project_id: input.project_id,
    name: input.name.trim(),
    goal: input.goal ?? "",
    state: "future",
    start_date: input.start_date ?? null,
    end_date: input.end_date ?? null,
    sort_order: ((maxOrder as number | null) ?? -1) + 1,
    created_at: now,
    updated_at: now,
    closed_at: null,
    deleted_at: null,
  };
  await orm.insert(sprints).values(row);
  return row;
}

export async function getSprint(id: string): Promise<Sprint | null> {
  const rows = await orm
    .select()
    .from(sprints)
    .where(and(eq(sprints.id, id), isNull(sprints.deleted_at)))
    .limit(1);
  return (rows[0] as Sprint | undefined) ?? null;
}

export async function listByProject(projectId: string): Promise<Sprint[]> {
  const rows = await orm
    .select()
    .from(sprints)
    .where(
      and(eq(sprints.project_id, projectId), isNull(sprints.deleted_at)),
    )
    .orderBy(asc(sprints.state), asc(sprints.sort_order));
  return rows as Sprint[];
}

export async function getActive(projectId: string): Promise<Sprint | null> {
  const rows = await orm
    .select()
    .from(sprints)
    .where(
      and(
        eq(sprints.project_id, projectId),
        eq(sprints.state, "active"),
        isNull(sprints.deleted_at),
      ),
    )
    .limit(1);
  return (rows[0] as Sprint | undefined) ?? null;
}

export type SprintPatch = Partial<
  Pick<Sprint, "name" | "goal" | "start_date" | "end_date">
>;

export async function updateSprint(id: string, patch: SprintPatch): Promise<void> {
  const update: Record<string, unknown> = { updated_at: nowIso() };
  if (patch.name !== undefined) update.name = patch.name.trim();
  if (patch.goal !== undefined) update.goal = patch.goal;
  if (patch.start_date !== undefined) update.start_date = patch.start_date;
  if (patch.end_date !== undefined) update.end_date = patch.end_date;
  await orm.update(sprints).set(update).where(eq(sprints.id, id));
}

// Start a sprint: future -> active. If another sprint is already active in
// this project, close it first (caller should have confirmed with the user).
export async function startSprint(id: string): Promise<void> {
  const sprint = await getSprint(id);
  if (!sprint) return;
  if (sprint.state !== "future") {
    throw new Error("이미 시작된 스프린트입니다");
  }
  const now = nowIso();
  const existingActive = await getActive(sprint.project_id);
  if (existingActive && existingActive.id !== id) {
    await closeSprint(existingActive.id);
  }
  await orm
    .update(sprints)
    .set({ state: "active", updated_at: now })
    .where(eq(sprints.id, id));
}

// Close a sprint: active -> closed. All non-done issues in the sprint are
// returned to the backlog (sprint_id = null).
export async function closeSprint(id: string): Promise<void> {
  const sprint = await getSprint(id);
  if (!sprint) return;
  if (sprint.state === "closed") return;
  const now = nowIso();

  await orm
    .update(issues)
    .set({ sprint_id: null, updated_at: now })
    .where(and(eq(issues.sprint_id, id), isNull(issues.deleted_at)));

  await orm
    .update(sprints)
    .set({ state: "closed", closed_at: now, updated_at: now })
    .where(eq(sprints.id, id));
}

export async function deleteSprint(id: string): Promise<void> {
  const now = nowIso();
  // Detach stories from this sprint first
  await orm
    .update(issues)
    .set({ sprint_id: null, updated_at: now })
    .where(eq(issues.sprint_id, id));
  await orm
    .update(sprints)
    .set({ deleted_at: now, updated_at: now })
    .where(eq(sprints.id, id));
}

export function isSprintState(v: unknown): v is SprintState {
  return v === "future" || v === "active" || v === "closed";
}
