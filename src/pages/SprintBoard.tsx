import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  ChevronDown,
  ChevronUp,
  Inbox,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Play,
  Plus,
  Square,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import IssueDetailPanel from "../components/IssueDetailPanel";
import SprintFormDialog from "../components/SprintFormDialog";
import SprintTimelineStrip from "../components/SprintTimelineStrip";
import { TaskCard } from "../components/TaskCard";
import * as issueRepo from "../lib/db/issue.repo";
import * as sprintRepo from "../lib/db/sprint.repo";
import {
  STATUS_LABELS,
  STATUS_ORDER,
  SPRINT_STATE_LABELS,
  type Issue,
  type IssueStatus,
  type Sprint,
} from "../lib/db/types";
import {
  dispatchSprintsChanged,
  useSprintContext,
} from "../lib/sprint/SprintContext";
import { formatDateRange, formatShortDate } from "../lib/sprint/timeline";
import { PriorityBadge } from "../components/issueMeta";
import { useDraggable } from "@dnd-kit/core";

const LS_TIMELINE_OPEN = "sb.timelineOpen";
const LS_BACKLOG_OPEN = "sb.backlogDrawerOpen";
const SPRINT_DROP_ID = "sprint-drop";
const BACKLOG_DROP_ID = "backlog-drop";

export default function SprintBoard() {
  const {
    projects,
    currentProjectId,
    setCurrentProjectId,
    sprints,
    currentSprintId,
    setCurrentSprintId,
    currentProject,
    currentSprint,
  } = useSprintContext();

  const [timelineOpen, setTimelineOpen] = useState<boolean>(
    () => localStorage.getItem(LS_TIMELINE_OPEN) !== "0",
  );
  function toggleTimeline() {
    setTimelineOpen((v) => {
      const next = !v;
      localStorage.setItem(LS_TIMELINE_OPEN, next ? "1" : "0");
      return next;
    });
  }

  const [backlogOpen, setBacklogOpen] = useState<boolean>(
    () => localStorage.getItem(LS_BACKLOG_OPEN) === "1",
  );
  function toggleBacklog() {
    setBacklogOpen((v) => {
      const next = !v;
      localStorage.setItem(LS_BACKLOG_OPEN, next ? "1" : "0");
      return next;
    });
  }

  const [stories, setStories] = useState<Issue[]>([]);
  const [tasks, setTasks] = useState<Issue[]>([]);
  const [unassignedStories, setUnassignedStories] = useState<Issue[]>([]);
  const [epicTitles, setEpicTitles] = useState<Record<string, string>>({});
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState<"create" | "edit" | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!currentSprintId) {
      setStories([]);
      setTasks([]);
    } else {
      const { stories: st, tasks: tk } = await issueRepo.listBySprint(currentSprintId);
      setStories(st);
      setTasks(tk);
    }

    if (currentProjectId) {
      const all = await issueRepo.listStoriesByProject(currentProjectId);
      setUnassignedStories(all.filter((s) => s.sprint_id === null));
      const epicIds = Array.from(
        new Set(all.map((s) => s.parent_id).filter(Boolean) as string[]),
      );
      const map: Record<string, string> = {};
      await Promise.all(
        epicIds.map(async (eid) => {
          const e = await issueRepo.getIssue(eid);
          if (e) map[eid] = e.title;
        }),
      );
      setEpicTitles(map);
    } else {
      setUnassignedStories([]);
      setEpicTitles({});
    }
  }, [currentSprintId, currentProjectId]);

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

  const storyMap = useMemo(() => {
    const m: Record<string, Issue> = {};
    for (const s of stories) m[s.id] = s;
    return m;
  }, [stories]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );

  const collisionDetection: CollisionDetection = (args) => {
    // Prefer pointer-within (precise), fall back to rect-intersection. For
    // task drags prioritize columns so a drop on a card resolves to that
    // column rather than the underlying SPRINT_DROP_ID wrapper.
    const pointer = pointerWithin(args);
    const pointerCols = pointer.filter((c) => String(c.id).startsWith("col:"));
    if (pointerCols.length) return pointerCols;
    if (pointer.length) return pointer;

    const rects = rectIntersection(args);
    const rectCols = rects.filter((c) => String(c.id).startsWith("col:"));
    if (rectCols.length) return rectCols;
    return rects;
  };

  async function onDragEnd(e: DragEndEvent) {
    setDragId(null);
    const id = String(e.active.id);
    const overId = e.over?.id ? String(e.over.id) : null;
    console.log("[sprint-board:drag-end]", {
      id,
      overId,
      isUnassigned: unassignedStories.some((s) => s.id === id),
      isSprintStory: stories.some((s) => s.id === id),
      isTask: tasks.some((t) => t.id === id),
    });
    if (!overId) return;

    // Case 1a: unassigned story from the drawer → drop anywhere in sprint
    // board assigns it to the current sprint.
    const unassigned = unassignedStories.find((s) => s.id === id);
    if (unassigned) {
      if (!currentSprintId) return;
      if (overId === BACKLOG_DROP_ID) return; // no-op: already in backlog
      await issueRepo.assignSprint(id, currentSprintId);
      dispatchSprintsChanged();
      await reload();
      return;
    }

    // Case 1b: sprint story dragged onto the backlog drawer → unassign.
    const sprintStory = stories.find((s) => s.id === id);
    if (sprintStory) {
      if (overId !== BACKLOG_DROP_ID) return; // only backlog drawer accepts
      await issueRepo.assignSprint(id, null);
      dispatchSprintsChanged();
      await reload();
      return;
    }

    // Case 2: dragging an existing task between status columns.
    let targetStatus: IssueStatus | undefined;
    if (overId.startsWith("col:")) {
      targetStatus = overId.slice(4) as IssueStatus;
    } else {
      targetStatus = tasks.find((t) => t.id === overId)?.status;
    }
    if (!targetStatus || !STATUS_ORDER.includes(targetStatus)) return;
    const current = tasks.find((t) => t.id === id);
    if (!current) return;
    const colTasks = tasks.filter((t) => t.status === targetStatus && t.id !== id);
    const nextOrder = colTasks.length
      ? Math.max(...colTasks.map((t) => t.sort_order)) + 1
      : 0;
    await issueRepo.moveIssue(id, targetStatus, nextOrder);
    await reload();
  }

  async function handleStart() {
    if (!currentSprint) return;
    const existingActive = sprints.find(
      (s) => s.state === "active" && s.id !== currentSprint.id,
    );
    if (existingActive) {
      const ok = confirm(
        `현재 진행 중인 스프린트 "${existingActive.name}"를 종료하고 "${currentSprint.name}"를 시작합니다.\n계속하시겠습니까?`,
      );
      if (!ok) return;
    }
    try {
      await sprintRepo.startSprint(currentSprint.id);
      dispatchSprintsChanged();
    } catch (err) {
      alert(`시작 실패\n${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async function handleClose() {
    if (!currentSprint) return;
    const nonDone = tasks.filter((t) => t.status !== "done").length;
    const ok = confirm(
      `스프린트를 완료합니다.\n미완료 이슈 ${nonDone}개는 백로그로 돌아갑니다.\n계속하시겠습니까?`,
    );
    if (!ok) return;
    try {
      await sprintRepo.closeSprint(currentSprint.id);
      dispatchSprintsChanged();
    } catch (err) {
      alert(`완료 실패\n${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const draggingTask = dragId ? tasks.find((t) => t.id === dragId) : null;
  const draggingUnassignedStory = dragId
    ? unassignedStories.find((s) => s.id === dragId)
    : null;
  const draggingSprintStory = dragId
    ? stories.find((s) => s.id === dragId)
    : null;
  const draggingStory = draggingUnassignedStory ?? draggingSprintStory;

  const hasProject = projects.length > 0;

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <Header
        projects={projects}
        currentProjectId={currentProjectId}
        onSelectProject={setCurrentProjectId}
        sprints={sprints}
        currentSprint={currentSprint}
        onSelectSprint={setCurrentSprintId}
        timelineOpen={timelineOpen}
        onToggleTimeline={toggleTimeline}
        backlogOpen={backlogOpen}
        onToggleBacklog={toggleBacklog}
        unassignedCount={unassignedStories.length}
        onCreate={() => setShowForm("create")}
        onEdit={() => setShowForm("edit")}
        onStart={handleStart}
        onClose={handleClose}
      />

      {!hasProject ? (
        <EmptyState
          title="프로젝트가 없습니다"
          hint="백로그 탭에서 프로젝트를 만드세요."
        />
      ) : !currentSprint ? (
        <EmptyState
          title="스프린트가 없습니다"
          hint={`${currentProject?.name ?? "프로젝트"}에 스프린트를 먼저 만드세요.`}
          actionLabel="새 스프린트"
          onAction={() => setShowForm("create")}
        />
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={collisionDetection}
          autoScroll={false}
          onDragStart={(e: DragStartEvent) => {
            const id = String(e.active.id);
            setDragId(id);
            // Auto-open the backlog drawer when dragging a sprint story, so
            // the drop target exists. Without this, users who never opened
            // the drawer have nowhere to drop.
            if (stories.find((s) => s.id === id) && !backlogOpen) {
              setBacklogOpen(true);
              localStorage.setItem(LS_BACKLOG_OPEN, "1");
            }
          }}
          onDragEnd={onDragEnd}
          onDragCancel={() => setDragId(null)}
        >
          {timelineOpen && (
            <SprintTimelineStrip
              sprint={currentSprint}
              stories={stories}
              onSelectStory={(id) => setSelectedTaskId(id)}
              onRemoveStory={async (id) => {
                await issueRepo.assignSprint(id, null);
                dispatchSprintsChanged();
                await reload();
              }}
            />
          )}
          <div className="relative flex min-h-0 flex-1">
            {backlogOpen && (
              <BacklogDrawer
                sprintStories={stories}
                unassignedStories={unassignedStories}
                epicTitles={epicTitles}
                acceptingDrop={!!draggingSprintStory}
              />
            )}
            <SprintDropZone active={!!draggingUnassignedStory}>
              <div
                className="flex min-h-0 flex-1 gap-3 overflow-x-auto p-4"
                style={selectedTaskId ? { paddingRight: "24rem" } : undefined}
              >
                {STATUS_ORDER.map((status) => (
                  <Column
                    key={status}
                    status={status}
                    tasks={tasks
                      .filter((t) => t.status === status)
                      .sort((a, b) => a.sort_order - b.sort_order)}
                    storyMap={storyMap}
                    epicTitles={epicTitles}
                    selectedId={selectedTaskId ?? undefined}
                    onSelect={(id) => setSelectedTaskId(id)}
                  />
                ))}
              </div>
            </SprintDropZone>
            <DragOverlay dropAnimation={null}>
              {draggingTask && (
                <div style={{ width: 272 }}>
                  <TaskCard
                    issue={draggingTask}
                    parent={parentBadges(storyMap, epicTitles, draggingTask)}
                    draggable={false}
                  />
                </div>
              )}
              {draggingStory && (
                <div style={{ width: 280 }}>
                  <StoryDragCard
                    story={draggingStory}
                    epicTitle={
                      draggingStory.parent_id
                        ? epicTitles[draggingStory.parent_id]
                        : undefined
                    }
                  />
                </div>
              )}
            </DragOverlay>
            {selectedTaskId && (
              <aside className="absolute right-0 top-0 bottom-0 z-10 flex w-96 flex-col overflow-hidden border-l border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
                <div className="flex items-center border-b border-gray-200 px-2 py-1 dark:border-gray-800">
                  <button
                    onClick={() => setSelectedTaskId(null)}
                    className="rounded p-1 text-xs text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                  >
                    닫기
                  </button>
                </div>
                <div className="flex-1 overflow-hidden">
                  <IssueDetailPanel issueId={selectedTaskId} />
                </div>
              </aside>
            )}
          </div>
        </DndContext>
      )}

      {showForm && currentProjectId && (
        <SprintFormDialog
          projectId={currentProjectId}
          sprint={showForm === "edit" ? currentSprint : null}
          onClose={() => setShowForm(null)}
          onSaved={(s) => {
            if (showForm === "create") setCurrentSprintId(s.id);
          }}
        />
      )}
    </div>
  );
}

function parentBadges(
  storyMap: Record<string, Issue>,
  epicTitles: Record<string, string>,
  task: Issue,
) {
  const story = task.parent_id ? storyMap[task.parent_id] : null;
  const epicId = story?.parent_id ?? null;
  return {
    storyTitle: story?.title,
    epicTitle: epicId ? epicTitles[epicId] : undefined,
  };
}

function Header(props: {
  projects: { id: string; name: string }[];
  currentProjectId: string | null;
  onSelectProject: (id: string | null) => void;
  sprints: Sprint[];
  currentSprint: Sprint | null;
  onSelectSprint: (id: string | null) => void;
  timelineOpen: boolean;
  onToggleTimeline: () => void;
  backlogOpen: boolean;
  onToggleBacklog: () => void;
  unassignedCount: number;
  onCreate: () => void;
  onEdit: () => void;
  onStart: () => void;
  onClose: () => void;
}) {
  const cs = props.currentSprint;
  return (
    <div className="flex shrink-0 items-center gap-3 border-b border-gray-200 px-4 py-2 dark:border-gray-800">
      <select
        value={props.currentProjectId ?? ""}
        onChange={(e) => props.onSelectProject(e.target.value || null)}
        className="rounded border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
      >
        <option value="">프로젝트 선택</option>
        {props.projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>

      <select
        value={cs?.id ?? ""}
        onChange={(e) => props.onSelectSprint(e.target.value || null)}
        disabled={props.sprints.length === 0}
        className="rounded border border-gray-300 bg-white px-2 py-1 text-sm disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900"
      >
        <option value="">스프린트 선택</option>
        {props.sprints.map((s) => (
          <option key={s.id} value={s.id}>
            [{SPRINT_STATE_LABELS[s.state]}] {s.name}
          </option>
        ))}
      </select>

      {cs && (
        <div className="text-xs text-gray-500">
          {formatDateRange(cs.start_date, cs.end_date)}
        </div>
      )}

      <div className="ml-auto flex items-center gap-1">
        {cs && (
          <button
            onClick={props.onToggleBacklog}
            title={props.backlogOpen ? "백로그 서랍 닫기" : "백로그 서랍 열기"}
            className={
              "flex items-center gap-1 rounded border px-2 py-1 text-xs " +
              (props.backlogOpen
                ? "border-blue-400 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-900/20 dark:text-blue-300"
                : "border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800")
            }
          >
            {props.backlogOpen ? <PanelLeftClose size={12} /> : <PanelLeftOpen size={12} />}
            <Inbox size={12} />
            백로그
            {props.unassignedCount > 0 && (
              <span className="rounded bg-gray-200 px-1 py-px text-[10px] text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                {props.unassignedCount}
              </span>
            )}
          </button>
        )}
        {cs && (
          <button
            onClick={props.onToggleTimeline}
            title={props.timelineOpen ? "타임라인 접기" : "타임라인 펼치기"}
            className="flex items-center gap-1 rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
          >
            {props.timelineOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            타임라인
          </button>
        )}
        {cs?.state === "future" && (
          <button
            onClick={props.onStart}
            className="flex items-center gap-1 rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700"
          >
            <Play size={12} /> 시작
          </button>
        )}
        {cs?.state === "active" && (
          <button
            onClick={props.onClose}
            className="flex items-center gap-1 rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
          >
            <Square size={12} /> 완료
          </button>
        )}
        {cs && cs.state !== "closed" && (
          <button
            onClick={props.onEdit}
            className="flex items-center gap-1 rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
          >
            <Pencil size={12} /> 편집
          </button>
        )}
        <button
          onClick={props.onCreate}
          disabled={!props.currentProjectId}
          className="flex items-center gap-1 rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:hover:bg-gray-800"
        >
          <Plus size={12} /> 새 스프린트
        </button>
      </div>
    </div>
  );
}

function EmptyState({
  title,
  hint,
  actionLabel,
  onAction,
}: {
  title: string;
  hint: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 text-sm text-gray-500">
      <div className="font-medium text-gray-700 dark:text-gray-300">{title}</div>
      <div className="text-xs">{hint}</div>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="mt-2 rounded bg-blue-600 px-3 py-1.5 text-xs text-white hover:bg-blue-700"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

function SprintDropZone({
  active,
  children,
}: {
  active: boolean;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: SPRINT_DROP_ID });
  return (
    <div
      ref={setNodeRef}
      className={
        "relative flex min-h-0 flex-1 transition-colors " +
        (active && isOver
          ? "bg-blue-50/70 dark:bg-blue-900/10"
          : "")
      }
    >
      {children}
      {active && (
        <div
          className={
            "pointer-events-none absolute inset-2 rounded-lg border-2 border-dashed transition-colors " +
            (isOver
              ? "border-blue-500 bg-blue-50/40 dark:border-blue-400 dark:bg-blue-900/20"
              : "border-blue-300 dark:border-blue-700")
          }
        >
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="rounded-full bg-blue-600 px-3 py-1 text-xs font-medium text-white shadow-lg">
              이 스프린트에 담기
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function BacklogDrawer({
  sprintStories,
  unassignedStories,
  epicTitles,
  acceptingDrop,
}: {
  sprintStories: Issue[];
  unassignedStories: Issue[];
  epicTitles: Record<string, string>;
  acceptingDrop: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: BACKLOG_DROP_ID });
  return (
    <aside className="flex w-72 shrink-0 flex-col overflow-hidden border-r border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900">
      <div className="flex flex-col overflow-hidden">
        <div className="flex items-center justify-between border-b border-gray-200 px-3 py-2 dark:border-gray-800">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">
            <Inbox size={12} />
            스프린트
          </div>
          <span className="rounded bg-gray-200 px-1.5 py-0.5 text-[10px] text-gray-700 dark:bg-gray-800 dark:text-gray-300">
            {sprintStories.length}
          </span>
        </div>
        <div className="flex max-h-60 flex-col gap-1.5 overflow-y-auto p-2">
          {sprintStories.length === 0 ? (
            <div className="px-2 py-3 text-center text-[11px] text-gray-400">
              담긴 스토리가 없습니다
            </div>
          ) : (
            sprintStories.map((s) => (
              <DraggableBacklogStory
                key={s.id}
                story={s}
                epicTitle={s.parent_id ? epicTitles[s.parent_id] : undefined}
              />
            ))
          )}
        </div>
      </div>

      <div
        ref={setNodeRef}
        className={
          "flex flex-1 flex-col overflow-hidden border-t-2 transition-colors " +
          (acceptingDrop
            ? isOver
              ? "border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-900/20"
              : "border-blue-400 border-dashed dark:border-blue-500"
            : "border-gray-200 dark:border-gray-800")
        }
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-3 py-2 dark:border-gray-800">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">
            미할당
          </div>
          <span className="rounded bg-gray-200 px-1.5 py-0.5 text-[10px] text-gray-700 dark:bg-gray-800 dark:text-gray-300">
            {unassignedStories.length}
          </span>
        </div>
        <div className="relative flex flex-1 flex-col gap-1.5 overflow-y-auto p-2">
          {acceptingDrop && (
            <div className="pointer-events-none absolute inset-2 z-10 flex items-center justify-center rounded-lg border-2 border-dashed border-blue-500 bg-blue-50/60 dark:border-blue-400 dark:bg-blue-900/20">
              <span className="rounded-full bg-blue-600 px-3 py-1 text-xs font-medium text-white shadow-lg">
                미할당으로 빼기
              </span>
            </div>
          )}
          {unassignedStories.length === 0 ? (
            <div className="px-2 py-6 text-center text-[11px] text-gray-400">
              미할당 스토리가 없습니다
            </div>
          ) : (
            unassignedStories.map((s) => (
              <DraggableBacklogStory
                key={s.id}
                story={s}
                epicTitle={s.parent_id ? epicTitles[s.parent_id] : undefined}
              />
            ))
          )}
        </div>
      </div>
    </aside>
  );
}

function DraggableBacklogStory({
  story,
  epicTitle,
}: {
  story: Issue;
  epicTitle?: string;
}) {
  const { setNodeRef, attributes, listeners, isDragging } = useDraggable({
    id: story.id,
  });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={
        "sb-fade-in flex cursor-grab touch-none flex-col gap-1 rounded border border-gray-200 bg-white p-2 text-xs shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md dark:border-gray-800 dark:bg-gray-950 " +
        (isDragging ? "opacity-30" : "")
      }
    >
      {epicTitle && (
        <span className="self-start rounded bg-purple-100 px-1 py-0.5 text-[10px] font-medium text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
          {epicTitle}
        </span>
      )}
      <div className="line-clamp-2 text-sm font-medium">{story.title}</div>
      <div className="flex items-center gap-1">
        <PriorityBadge priority={story.priority} />
        {story.due_date && (
          <span className="ml-auto text-[10px] text-gray-500 dark:text-gray-400">
            {formatShortDate(story.due_date)}
          </span>
        )}
      </div>
    </div>
  );
}

function StoryDragCard({
  story,
  epicTitle,
}: {
  story: Issue;
  epicTitle?: string;
}) {
  return (
    <div className="flex flex-col gap-1 rounded border border-blue-500 bg-white p-2 text-xs shadow-2xl ring-1 ring-blue-500 dark:bg-gray-950">
      {epicTitle && (
        <span className="self-start rounded bg-purple-100 px-1 py-0.5 text-[10px] font-medium text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
          {epicTitle}
        </span>
      )}
      <div className="line-clamp-2 text-sm font-medium">{story.title}</div>
      <div className="flex items-center gap-1">
        <PriorityBadge priority={story.priority} />
      </div>
    </div>
  );
}

function Column({
  status,
  tasks,
  storyMap,
  epicTitles,
  selectedId,
  onSelect,
}: {
  status: IssueStatus;
  tasks: Issue[];
  storyMap: Record<string, Issue>;
  epicTitles: Record<string, string>;
  selectedId?: string;
  onSelect: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `col:${status}` });
  return (
    <div
      ref={setNodeRef}
      className={
        "flex w-72 shrink-0 flex-col rounded-lg border transition-colors duration-150 " +
        (isOver
          ? "border-blue-400 bg-blue-50 dark:border-blue-500 dark:bg-blue-900/20"
          : "border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900")
      }
    >
      <div className="flex items-center justify-between px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">
        <span>{STATUS_LABELS[status]}</span>
        <span className="rounded bg-gray-200 px-1.5 py-0.5 text-[10px] text-gray-700 dark:bg-gray-800 dark:text-gray-300">
          {tasks.length}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2">
        {tasks.map((t) => (
          <TaskCard
            key={t.id}
            issue={t}
            selected={selectedId === t.id}
            onSelect={() => onSelect(t.id)}
            parent={parentBadges(storyMap, epicTitles, t)}
          />
        ))}
      </div>
    </div>
  );
}
