import type { IssueStatus } from "../db/types";

// Tailwind classes for status-colored bars / badges. Shared between the
// timeline strip and the task card progress hint.
export const STATUS_BAR_BG: Record<IssueStatus, string> = {
  backlog: "bg-gray-400 dark:bg-gray-500",
  todo: "bg-blue-400 dark:bg-blue-500",
  in_progress: "bg-amber-400 dark:bg-amber-500",
  done: "bg-green-500 dark:bg-green-500",
};

export const STATUS_TEXT: Record<IssueStatus, string> = {
  backlog: "text-gray-600 dark:text-gray-400",
  todo: "text-blue-600 dark:text-blue-400",
  in_progress: "text-amber-600 dark:text-amber-400",
  done: "text-green-600 dark:text-green-400",
};
