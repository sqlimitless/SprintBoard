import { useDraggable } from "@dnd-kit/core";
import { X } from "lucide-react";
import { useMemo } from "react";
import type { Issue, Sprint } from "../lib/db/types";
import {
  barPosition,
  formatShortDate,
  parseDate,
  toDateOnly,
  todayMarkerPct,
} from "../lib/sprint/timeline";
import { STATUS_BAR_BG } from "../lib/ui/statusColor";

type Props = {
  sprint: Sprint;
  stories: Issue[];
  onSelectStory?: (storyId: string) => void;
  onRemoveStory?: (storyId: string) => void;
  height?: number;
};

export default function SprintTimelineStrip({
  sprint,
  stories,
  onSelectStory,
  onRemoveStory,
  height = 180,
}: Props) {
  const range = useMemo(() => {
    const s = parseDate(sprint.start_date);
    const e = parseDate(sprint.end_date);
    if (!s || !e || e < s) return null;
    return { start: toDateOnly(s), end: toDateOnly(e) };
  }, [sprint.start_date, sprint.end_date]);

  if (!range) {
    return (
      <div className="flex h-16 items-center justify-center border-b border-gray-200 text-xs text-gray-500 dark:border-gray-800">
        스프린트 기간이 설정되지 않았습니다.
      </div>
    );
  }

  const today = todayMarkerPct(range.start, range.end);

  return (
    <div
      className="flex flex-col border-b border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900"
      style={{ height }}
    >
      <div className="flex items-center justify-between px-4 pt-2 text-[11px] text-gray-500">
        <span>{formatShortDate(sprint.start_date)}</span>
        <span className="font-medium">{sprint.name}</span>
        <span>{formatShortDate(sprint.end_date)}</span>
      </div>
      <div className="relative flex-1 overflow-y-auto px-4 py-2">
        {today !== null && (
          <div
            className="pointer-events-none absolute top-0 bottom-0 z-10 w-px bg-red-500"
            style={{ left: `calc(${today}% + 1rem)` }}
            title="오늘"
          />
        )}
        {stories.length === 0 && (
          <div className="flex h-full items-center justify-center text-xs text-gray-400">
            스토리가 없습니다. 백로그에서 스토리를 할당하세요.
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          {stories.map((story) => {
            const bs = parseDate(story.start_date);
            const be = parseDate(story.due_date);
            const pos = barPosition(range.start, range.end, bs, be);
            return (
              <StoryRow
                key={story.id}
                story={story}
                pos={pos}
                onSelect={() => onSelectStory?.(story.id)}
                onRemove={
                  onRemoveStory ? () => onRemoveStory(story.id) : undefined
                }
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

function StoryRow({
  story,
  pos,
  onSelect,
  onRemove,
}: {
  story: Issue;
  pos: { leftPct: number; widthPct: number } | null;
  onSelect: () => void;
  onRemove?: () => void;
}) {
  const { setNodeRef, attributes, listeners, isDragging } = useDraggable({
    id: story.id,
  });
  return (
    <div className="group relative flex h-6 items-center" onClick={onSelect}>
      <div className="pointer-events-none absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-gray-200 dark:bg-gray-800" />
      {pos ? (
        <div
          ref={setNodeRef}
          {...attributes}
          {...listeners}
          className={
            "absolute top-1 bottom-1 flex cursor-grab touch-none items-center gap-1 rounded px-2 text-[10px] text-white shadow-sm transition-opacity hover:opacity-90 " +
            STATUS_BAR_BG[story.status] +
            (isDragging ? " opacity-30" : "")
          }
          style={{ left: `${pos.leftPct}%`, width: `${pos.widthPct}%` }}
          title={story.title}
        >
          <span className="line-clamp-1 flex-1 leading-4">{story.title}</span>
          {onRemove && (
            <button
              type="button"
              title="스프린트에서 빼기"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
              className="shrink-0 rounded-full bg-white/30 p-0.5 hover:bg-white/60"
            >
              <X size={10} />
            </button>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-1">
          <div
            ref={setNodeRef}
            {...attributes}
            {...listeners}
            className={
              "cursor-grab touch-none rounded bg-gray-300 px-2 text-[10px] text-gray-700 dark:bg-gray-700 dark:text-gray-200 " +
              (isDragging ? "opacity-30" : "")
            }
          >
            {story.title} (기간 미정)
          </div>
          {onRemove && (
            <button
              type="button"
              title="스프린트에서 빼기"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
              className="rounded-full p-0.5 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700"
            >
              <X size={10} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
