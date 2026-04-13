import { Bookmark, BookOpen, CheckSquare } from "lucide-react";
import type { IssueType, Priority } from "../lib/db/types";

export function IssueTypeIcon({
  type,
  size = 14,
}: {
  type: IssueType;
  size?: number;
}) {
  switch (type) {
    case "epic":
      return <Bookmark size={size} className="text-purple-600 dark:text-purple-400" />;
    case "story":
      return <BookOpen size={size} className="text-green-600 dark:text-green-400" />;
    case "task":
    default:
      return <CheckSquare size={size} className="text-blue-600 dark:text-blue-400" />;
  }
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  const cls =
    priority === "urgent"
      ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
      : priority === "high"
      ? "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300"
      : priority === "medium"
      ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300"
      : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400";
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-[10px] font-medium uppercase ${cls}`}
    >
      {priority}
    </span>
  );
}
