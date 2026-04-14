import { useDraggable } from "@dnd-kit/core";
import type { Issue } from "../lib/db/types";
import { formatShortDate, progressRatio } from "../lib/sprint/timeline";
import { STATUS_BAR_BG } from "../lib/ui/statusColor";
import { PriorityBadge } from "./issueMeta";

export type TaskCardParent = {
  epicTitle?: string;
  storyTitle?: string;
};

type Props = {
  issue: Issue;
  selected?: boolean;
  onSelect?: () => void;
  parent?: TaskCardParent;
  draggable?: boolean;
};

export function TaskCard({
  issue,
  selected = false,
  onSelect,
  parent,
  draggable = true,
}: Props) {
  const { setNodeRef, attributes, listeners, isDragging } = useDraggable({
    id: issue.id,
    disabled: !draggable,
  });

  const ratio = progressRatio(issue.start_date, issue.due_date);
  const hasDates = !!(issue.start_date || issue.due_date);

  return (
    <div
      ref={setNodeRef}
      {...(draggable ? attributes : {})}
      {...(draggable ? listeners : {})}
      onClick={onSelect}
      className={
        "sb-fade-in cursor-grab touch-none rounded border bg-white p-2 text-sm shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md dark:bg-gray-950 " +
        (selected
          ? "border-blue-500 ring-1 ring-blue-500 dark:border-blue-400"
          : "border-gray-200 dark:border-gray-800") +
        (isDragging ? " opacity-30" : "")
      }
    >
      {(parent?.epicTitle || parent?.storyTitle) && (
        <div className="mb-1 flex items-center gap-1 truncate text-[10px] font-medium text-gray-500 dark:text-gray-400">
          {parent.epicTitle && (
            <span className="rounded bg-purple-100 px-1 py-0.5 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
              {parent.epicTitle}
            </span>
          )}
          {parent.epicTitle && parent.storyTitle && <span>›</span>}
          {parent.storyTitle && (
            <span className="rounded bg-green-100 px-1 py-0.5 text-green-700 dark:bg-green-900/40 dark:text-green-300">
              {parent.storyTitle}
            </span>
          )}
        </div>
      )}
      <div className="line-clamp-2 font-medium">{issue.title}</div>
      <div className="mt-1.5 flex items-center gap-1">
        <PriorityBadge priority={issue.priority} />
        {hasDates && (
          <span className="ml-auto text-[10px] text-gray-500 dark:text-gray-400">
            {formatShortDate(issue.due_date)}
          </span>
        )}
      </div>
      {hasDates && ratio !== null && (
        <div className="mt-1.5 h-1 w-full overflow-hidden rounded bg-gray-200 dark:bg-gray-800">
          <div
            className={"h-full " + STATUS_BAR_BG[issue.status]}
            style={{ width: `${Math.round(ratio * 100)}%` }}
          />
        </div>
      )}
    </div>
  );
}
