import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { Check, Plus, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import * as issueRepo from "../lib/db/issue.repo";
import {
  PRIORITIES,
  STATUS_LABELS,
  STATUS_ORDER,
  type Issue,
  type IssueStatus,
  type Priority,
} from "../lib/db/types";
import { PriorityBadge } from "./issueMeta";

type Props = {
  parentId: string;
  level: "story" | "task";
  onSelect: (id: string) => void;
  selectedId?: string;
};

export default function KanbanBoard({ parentId, level, onSelect, selectedId }: Props) {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [dragId, setDragId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const rows = await issueRepo.listChildren(parentId);
    setIssues(rows.filter((r) => r.type === level));
  }, [parentId, level]);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    function onChanged() {
      reload();
    }
    window.addEventListener("issues:changed", onChanged);
    return () => window.removeEventListener("issues:changed", onChanged);
  }, [reload]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  function onDragStart(e: DragStartEvent) {
    setDragId(String(e.active.id));
  }

  async function onDragEnd(e: DragEndEvent) {
    setDragId(null);
    const id = String(e.active.id);
    const overId = e.over?.id ? String(e.over.id) : null;
    if (!overId) return;

    let targetStatus: IssueStatus | undefined;
    if (overId.startsWith("col:")) {
      targetStatus = overId.slice(4) as IssueStatus;
    } else {
      const overIssue = issues.find((i) => i.id === overId);
      targetStatus = overIssue?.status;
    }
    if (!targetStatus || !STATUS_ORDER.includes(targetStatus)) return;

    const current = issues.find((i) => i.id === id);
    if (!current) return;

    const colIssues = issues.filter(
      (i) => i.status === targetStatus && i.id !== id,
    );
    const nextOrder = colIssues.length
      ? Math.max(...colIssues.map((i) => i.sort_order)) + 1
      : 0;
    await issueRepo.moveIssue(id, targetStatus, nextOrder);
    await reload();
  }

  // Prefer pointer position; fall back to rect intersection so drops over a
  // card (not the column padding) still resolve to the correct column.
  const collisionDetection: CollisionDetection = (args) => {
    const pointer = pointerWithin(args);
    const cols = pointer.filter((c) => String(c.id).startsWith("col:"));
    if (cols.length) return cols;
    if (pointer.length) return pointer;
    const rects = rectIntersection(args);
    const colRects = rects.filter((c) => String(c.id).startsWith("col:"));
    return colRects.length ? colRects : rects;
  };

  const dragging = dragId ? issues.find((i) => i.id === dragId) : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setDragId(null)}
    >
      <div className="flex h-full min-h-0 flex-1 gap-3 overflow-x-auto p-4">
        {STATUS_ORDER.map((status) => (
          <Column
            key={status}
            status={status}
            parentId={parentId}
            level={level}
            issues={issues
              .filter((i) => i.status === status)
              .sort((a, b) => a.sort_order - b.sort_order)}
            onSelect={onSelect}
            selectedId={selectedId}
            onCreated={reload}
          />
        ))}
      </div>
      <DragOverlay dropAnimation={null}>
        {dragging && <CardView issue={dragging} />}
      </DragOverlay>
    </DndContext>
  );
}

function Column({
  status,
  parentId,
  level,
  issues,
  onSelect,
  selectedId,
  onCreated,
}: {
  status: IssueStatus;
  parentId: string;
  level: "story" | "task";
  issues: Issue[];
  onSelect: (id: string) => void;
  selectedId?: string;
  onCreated: () => void | Promise<void>;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `col:${status}` });
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");

  async function submit() {
    const t = title.trim();
    if (!t) {
      setAdding(false);
      return;
    }
    try {
      const parent = await issueRepo.getIssue(parentId);
      if (parent) {
        const created = await issueRepo.createIssue({
          project_id: parent.project_id,
          type: level,
          parent_id: parentId,
          title: t,
          status,
          priority,
        });
        window.dispatchEvent(
          new CustomEvent("issues:changed", { detail: { parentId } }),
        );
        await onCreated();
        if (level === "task") onSelect(created.id);
      }
    } catch (err) {
      console.error(err);
      alert(`생성 실패\n${err instanceof Error ? err.message : String(err)}`);
    }
    setTitle("");
    setPriority("medium");
    setAdding(false);
  }

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
          {issues.length}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2">
        {issues.map((iss) => (
          <Card
            key={iss.id}
            issue={iss}
            selected={selectedId === iss.id}
            onSelect={() => onSelect(iss.id)}
          />
        ))}
        {adding ? (
          <div className="sb-pop-in rounded border border-blue-400 bg-white p-2 dark:border-blue-500 dark:bg-gray-900">
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  submit();
                }
                if (e.key === "Escape") {
                  e.preventDefault();
                  setAdding(false);
                }
              }}
              placeholder={level === "story" ? "새 스토리" : "새 태스크"}
              className="w-full bg-transparent text-sm outline-none"
            />
            <div className="mt-2 flex items-center gap-1 border-t border-gray-200 pt-2 text-xs dark:border-gray-700">
              <label className="flex items-center gap-1 text-gray-500">
                우선순위
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as Priority)}
                  className="rounded border border-gray-300 bg-white px-1 py-0.5 dark:border-gray-700 dark:bg-gray-950"
                >
                  {PRIORITIES.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="ml-auto flex items-center gap-0.5">
                <button
                  type="button"
                  title="취소"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setAdding(false);
                  }}
                  className="rounded p-1 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  <X size={12} />
                </button>
                <button
                  type="button"
                  title="생성"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    submit();
                  }}
                  className="rounded p-1 text-green-600 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-900/30"
                >
                  <Check size={12} />
                </button>
              </div>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="flex items-center gap-1 rounded px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
          >
            <Plus size={12} /> 새 {level === "story" ? "스토리" : "태스크"}
          </button>
        )}
      </div>
    </div>
  );
}

function Card({
  issue,
  selected,
  onSelect,
}: {
  issue: Issue;
  selected: boolean;
  onSelect: () => void;
}) {
  const { setNodeRef, attributes, listeners, isDragging } = useDraggable({
    id: issue.id,
  });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={onSelect}
      className={
        "sb-fade-in cursor-grab touch-none rounded border bg-white p-2 text-sm shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md dark:bg-gray-950 " +
        (selected
          ? "border-blue-500 ring-1 ring-blue-500 dark:border-blue-400"
          : "border-gray-200 dark:border-gray-800") +
        (isDragging ? " opacity-30" : "")
      }
    >
      <div className="line-clamp-2 font-medium">{issue.title}</div>
      <div className="mt-1.5 flex items-center gap-1">
        <PriorityBadge priority={issue.priority} />
      </div>
    </div>
  );
}

function CardView({ issue }: { issue: Issue }) {
  // Width must match the source card (column w-72=288px minus px-2=16px → 272px).
  return (
    <div
      style={{ width: 272 }}
      className="cursor-grabbing rounded border border-blue-500 bg-white p-2 text-sm shadow-2xl ring-1 ring-blue-500 dark:bg-gray-950"
    >
      <div className="line-clamp-2 font-medium">{issue.title}</div>
      <div className="mt-1.5 flex items-center gap-1">
        <PriorityBadge priority={issue.priority} />
      </div>
    </div>
  );
}
