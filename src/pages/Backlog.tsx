import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { Play, Plus, Square } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import SprintFormDialog from "../components/SprintFormDialog";
import { PriorityBadge } from "../components/issueMeta";
import * as issueRepo from "../lib/db/issue.repo";
import * as sprintRepo from "../lib/db/sprint.repo";
import {
  SPRINT_STATE_LABELS,
  type Issue,
  type Sprint,
} from "../lib/db/types";
import {
  dispatchSprintsChanged,
  useSprintContext,
} from "../lib/sprint/SprintContext";
import { formatDateRange, formatShortDate } from "../lib/sprint/timeline";

const BACKLOG_DROP_ID = "backlog:null";
const sprintDropId = (id: string) => `sprint:${id}`;

export default function Backlog() {
  const {
    projects,
    currentProjectId,
    setCurrentProjectId,
    sprints,
    currentProject,
  } = useSprintContext();

  const [stories, setStories] = useState<Issue[]>([]);
  const [epicTitles, setEpicTitles] = useState<Record<string, string>>({});
  const [dragId, setDragId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editSprint, setEditSprint] = useState<Sprint | null>(null);

  const reload = useCallback(async () => {
    if (!currentProjectId) {
      setStories([]);
      setEpicTitles({});
      return;
    }
    const list = await issueRepo.listStoriesByProject(currentProjectId);
    setStories(list);
    const epicIds = Array.from(
      new Set(list.map((s) => s.parent_id).filter(Boolean) as string[]),
    );
    const map: Record<string, string> = {};
    await Promise.all(
      epicIds.map(async (eid) => {
        const e = await issueRepo.getIssue(eid);
        if (e) map[eid] = e.title;
      }),
    );
    setEpicTitles(map);
  }, [currentProjectId]);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    const onChanged = () => reload();
    window.addEventListener("issues:changed", onChanged);
    window.addEventListener("sprints:changed", onChanged);
    return () => {
      window.removeEventListener("issues:changed", onChanged);
      window.removeEventListener("sprints:changed", onChanged);
    };
  }, [reload]);

  // Group stories by sprint_id (null key = backlog)
  const byBucket = useMemo(() => {
    const m = new Map<string, Issue[]>();
    m.set("", []); // backlog
    for (const s of sprints) m.set(s.id, []);
    for (const story of stories) {
      const k = story.sprint_id ?? "";
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(story);
    }
    return m;
  }, [stories, sprints]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );

  async function onDragEnd(e: DragEndEvent) {
    setDragId(null);
    const id = String(e.active.id);
    const overId = e.over?.id ? String(e.over.id) : null;
    if (!overId) return;

    let targetSprintId: string | null = null;
    if (overId === BACKLOG_DROP_ID) {
      targetSprintId = null;
    } else if (overId.startsWith("sprint:")) {
      targetSprintId = overId.slice("sprint:".length);
    } else {
      // Dropped on another story card — find its bucket
      const target = stories.find((s) => s.id === overId);
      if (!target) return;
      targetSprintId = target.sprint_id;
    }

    const current = stories.find((s) => s.id === id);
    if (!current) return;
    if ((current.sprint_id ?? null) === targetSprintId) return;

    await issueRepo.assignSprint(id, targetSprintId);
    dispatchSprintsChanged();
    await reload();
  }

  async function handleStart(sprint: Sprint) {
    const other = sprints.find((s) => s.state === "active" && s.id !== sprint.id);
    if (other) {
      const ok = confirm(
        `현재 진행 중인 "${other.name}"를 종료하고 "${sprint.name}"를 시작합니다.\n계속하시겠습니까?`,
      );
      if (!ok) return;
    }
    try {
      await sprintRepo.startSprint(sprint.id);
      dispatchSprintsChanged();
    } catch (err) {
      alert(`시작 실패\n${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async function handleClose(sprint: Sprint) {
    const list = byBucket.get(sprint.id) ?? [];
    const ok = confirm(
      `"${sprint.name}"를 완료합니다.\n스토리 ${list.length}개는 백로그로 돌아갑니다.\n계속하시겠습니까?`,
    );
    if (!ok) return;
    try {
      await sprintRepo.closeSprint(sprint.id);
      dispatchSprintsChanged();
    } catch (err) {
      alert(`완료 실패\n${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const dragging = dragId ? stories.find((s) => s.id === dragId) : null;
  const openSprints = sprints.filter((s) => s.state !== "closed");

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      <div className="flex shrink-0 items-center gap-3 border-b border-gray-200 px-4 py-2 dark:border-gray-800">
        <select
          value={currentProjectId ?? ""}
          onChange={(e) => setCurrentProjectId(e.target.value || null)}
          className="rounded border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
        >
          <option value="">프로젝트 선택</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <div className="ml-auto">
          <button
            onClick={() => setShowCreate(true)}
            disabled={!currentProjectId}
            className="flex items-center gap-1 rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:hover:bg-gray-800"
          >
            <Plus size={12} /> 새 스프린트
          </button>
        </div>
      </div>

      {!currentProject ? (
        <div className="flex flex-1 items-center justify-center text-sm text-gray-500">
          프로젝트를 선택하세요.
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          onDragStart={(e: DragStartEvent) => setDragId(String(e.active.id))}
          onDragEnd={onDragEnd}
          onDragCancel={() => setDragId(null)}
        >
          <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
            {openSprints.map((sprint) => (
              <SprintSection
                key={sprint.id}
                sprint={sprint}
                stories={byBucket.get(sprint.id) ?? []}
                epicTitles={epicTitles}
                onStart={() => handleStart(sprint)}
                onClose={() => handleClose(sprint)}
                onEdit={() => setEditSprint(sprint)}
              />
            ))}
            <BacklogSection
              stories={byBucket.get("") ?? []}
              epicTitles={epicTitles}
            />
            {sprints
              .filter((s) => s.state === "closed")
              .map((sprint) => (
                <ClosedSection
                  key={sprint.id}
                  sprint={sprint}
                  stories={byBucket.get(sprint.id) ?? []}
                  epicTitles={epicTitles}
                />
              ))}
          </div>
          <DragOverlay dropAnimation={null}>
            {dragging && (
              <div style={{ width: 320 }}>
                <StoryCard
                  story={dragging}
                  epicTitle={dragging.parent_id ? epicTitles[dragging.parent_id] : undefined}
                  draggable={false}
                />
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}

      {showCreate && currentProjectId && (
        <SprintFormDialog
          projectId={currentProjectId}
          onClose={() => setShowCreate(false)}
        />
      )}
      {editSprint && currentProjectId && (
        <SprintFormDialog
          projectId={currentProjectId}
          sprint={editSprint}
          onClose={() => setEditSprint(null)}
        />
      )}
    </div>
  );
}

function SprintSection({
  sprint,
  stories,
  epicTitles,
  onStart,
  onClose,
  onEdit,
}: {
  sprint: Sprint;
  stories: Issue[];
  epicTitles: Record<string, string>;
  onStart: () => void;
  onClose: () => void;
  onEdit: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: sprintDropId(sprint.id) });
  return (
    <section
      ref={setNodeRef}
      className={
        "rounded-lg border transition-colors " +
        (isOver
          ? "border-blue-400 bg-blue-50 dark:border-blue-500 dark:bg-blue-900/20"
          : "border-gray-200 dark:border-gray-800")
      }
    >
      <header className="flex items-center gap-2 border-b border-gray-200 px-3 py-2 dark:border-gray-800">
        <span
          className={
            "rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase " +
            (sprint.state === "active"
              ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
              : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300")
          }
        >
          {SPRINT_STATE_LABELS[sprint.state]}
        </span>
        <div className="font-medium">{sprint.name}</div>
        <div className="text-xs text-gray-500">
          {formatDateRange(sprint.start_date, sprint.end_date)}
        </div>
        <div className="text-xs text-gray-400">· 스토리 {stories.length}개</div>
        <div className="ml-auto flex items-center gap-1">
          {sprint.state === "future" && (
            <button
              onClick={onStart}
              className="flex items-center gap-1 rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700"
            >
              <Play size={11} /> 시작
            </button>
          )}
          {sprint.state === "active" && (
            <button
              onClick={onClose}
              className="flex items-center gap-1 rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
            >
              <Square size={11} /> 완료
            </button>
          )}
          <button
            onClick={onEdit}
            className="rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
          >
            편집
          </button>
        </div>
      </header>
      <div className="flex flex-col gap-1.5 p-2 min-h-12">
        {stories.length === 0 && (
          <div className="py-3 text-center text-[11px] text-gray-400">
            스토리를 여기로 끌어오세요
          </div>
        )}
        {stories.map((s) => (
          <StoryCard
            key={s.id}
            story={s}
            epicTitle={s.parent_id ? epicTitles[s.parent_id] : undefined}
          />
        ))}
      </div>
    </section>
  );
}

function BacklogSection({
  stories,
  epicTitles,
}: {
  stories: Issue[];
  epicTitles: Record<string, string>;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: BACKLOG_DROP_ID });
  return (
    <section
      ref={setNodeRef}
      className={
        "rounded-lg border transition-colors " +
        (isOver
          ? "border-blue-400 bg-blue-50 dark:border-blue-500 dark:bg-blue-900/20"
          : "border-gray-300 border-dashed dark:border-gray-700")
      }
    >
      <header className="flex items-center gap-2 border-b border-gray-200 border-dashed px-3 py-2 dark:border-gray-800">
        <div className="font-medium">백로그 (미할당)</div>
        <div className="text-xs text-gray-400">· 스토리 {stories.length}개</div>
      </header>
      <div className="flex flex-col gap-1.5 p-2 min-h-12">
        {stories.length === 0 && (
          <div className="py-3 text-center text-[11px] text-gray-400">
            미할당 스토리가 없습니다
          </div>
        )}
        {stories.map((s) => (
          <StoryCard
            key={s.id}
            story={s}
            epicTitle={s.parent_id ? epicTitles[s.parent_id] : undefined}
          />
        ))}
      </div>
    </section>
  );
}

function ClosedSection({
  sprint,
  stories,
  epicTitles,
}: {
  sprint: Sprint;
  stories: Issue[];
  epicTitles: Record<string, string>;
}) {
  return (
    <section className="rounded-lg border border-gray-200 opacity-70 dark:border-gray-800">
      <header className="flex items-center gap-2 border-b border-gray-200 px-3 py-2 dark:border-gray-800">
        <span className="rounded bg-gray-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-gray-600 dark:bg-gray-800 dark:text-gray-300">
          완료
        </span>
        <div className="font-medium">{sprint.name}</div>
        <div className="text-xs text-gray-500">
          {formatDateRange(sprint.start_date, sprint.end_date)}
        </div>
        <div className="text-xs text-gray-400">· 스토리 {stories.length}개</div>
      </header>
      <div className="flex flex-col gap-1.5 p-2">
        {stories.map((s) => (
          <StoryCard
            key={s.id}
            story={s}
            epicTitle={s.parent_id ? epicTitles[s.parent_id] : undefined}
            draggable={false}
          />
        ))}
      </div>
    </section>
  );
}

function StoryCard({
  story,
  epicTitle,
  draggable = true,
}: {
  story: Issue;
  epicTitle?: string;
  draggable?: boolean;
}) {
  const { setNodeRef, attributes, listeners, isDragging } = useDraggable({
    id: story.id,
    disabled: !draggable,
  });
  const hasDates = !!(story.start_date || story.due_date);
  return (
    <div
      ref={setNodeRef}
      {...(draggable ? attributes : {})}
      {...(draggable ? listeners : {})}
      className={
        "sb-fade-in flex items-center gap-2 rounded border border-gray-200 bg-white px-2 py-1.5 text-sm shadow-sm transition-all dark:border-gray-800 dark:bg-gray-950 " +
        (draggable ? "cursor-grab touch-none hover:-translate-y-0.5 hover:shadow-md" : "") +
        (isDragging ? " opacity-30" : "")
      }
    >
      {epicTitle && (
        <span className="shrink-0 rounded bg-purple-100 px-1.5 py-0.5 text-[10px] font-medium text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
          {epicTitle}
        </span>
      )}
      <span className="flex-1 truncate">{story.title}</span>
      <PriorityBadge priority={story.priority} />
      {hasDates && (
        <span className="shrink-0 text-[10px] text-gray-500 dark:text-gray-400">
          {formatShortDate(story.due_date)}
        </span>
      )}
    </div>
  );
}
