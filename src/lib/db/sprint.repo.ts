import { and, asc, eq, isNull, max } from "drizzle-orm";
import { newId, nowIso, orm } from "./connection";
import { sprints } from "./schema";
import type { Sprint, SprintState } from "./types";

export type CreateSprintInput = {
  project_id: string;
  name: string;
  goal?: string;
  start_date?: string | null;
  end_date?: string | null;
};

export async function createSprint(input: CreateSprintInput): Promise<Sprint> {
  const id = newId();
  const now = nowIso();

  const [{ maxOrder }] = await orm
    .select({ maxOrder: max(sprints.sort_order) })
    .from(sprints)
    .where(
      and(eq(sprints.project_id, input.project_id), isNull(sprints.deleted_at)),
    );

  await orm.insert(sprints).values({
    id,
    project_id: input.project_id,
    name: input.name,
    goal: input.goal ?? "",
    state: "future",
    start_date: input.start_date ?? null,
    end_date: input.end_date ?? null,
    sort_order: (maxOrder ?? -1) + 1,
    created_at: now,
    updated_at: now,
  });

  return (await getSprintById(id))!;
}

export async function getSprintById(id: string): Promise<Sprint | null> {
  const rows = await orm
    .select()
    .from(sprints)
    .where(and(eq(sprints.id, id), isNull(sprints.deleted_at)))
    .limit(1);
  return (rows[0] as Sprint | undefined) ?? null;
}

export async function listSprints(
  projectId: string,
  state?: SprintState,
): Promise<Sprint[]> {
  const where = state
    ? and(
        eq(sprints.project_id, projectId),
        eq(sprints.state, state),
        isNull(sprints.deleted_at),
      )
    : and(eq(sprints.project_id, projectId), isNull(sprints.deleted_at));

  const rows = await orm
    .select()
    .from(sprints)
    .where(where)
    .orderBy(asc(sprints.sort_order));
  return rows as Sprint[];
}

export async function getActiveSprint(projectId: string): Promise<Sprint | null> {
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

export async function startSprint(id: string): Promise<void> {
  await orm
    .update(sprints)
    .set({ state: "active", updated_at: nowIso() })
    .where(eq(sprints.id, id));
}

export async function closeSprint(id: string): Promise<void> {
  const now = nowIso();
  await orm
    .update(sprints)
    .set({ state: "closed", completed_at: now, updated_at: now })
    .where(eq(sprints.id, id));
}

export async function updateSprint(
  id: string,
  patch: Partial<Pick<Sprint, "name" | "goal" | "start_date" | "end_date">>,
): Promise<void> {
  await orm
    .update(sprints)
    .set({ ...patch, updated_at: nowIso() })
    .where(eq(sprints.id, id));
}

export async function softDeleteSprint(id: string): Promise<void> {
  const now = nowIso();
  await orm
    .update(sprints)
    .set({ deleted_at: now, updated_at: now })
    .where(eq(sprints.id, id));
}
