export type ProjectStatus = "active" | "archived";

export const PROJECT_STATUSES: { value: ProjectStatus; label: string }[] = [
  { value: "active", label: "활성" },
  { value: "archived", label: "보관" },
];

export type IssueType = "epic" | "story" | "task";
export type IssueStatus = "backlog" | "todo" | "in_progress" | "done";
export type Priority = "urgent" | "high" | "medium" | "low";

export const STATUS_ORDER: IssueStatus[] = [
  "backlog",
  "todo",
  "in_progress",
  "done",
];

export const STATUS_LABELS: Record<IssueStatus, string> = {
  backlog: "Backlog",
  todo: "To Do",
  in_progress: "In Progress",
  done: "Done",
};

export const PRIORITIES: { value: Priority; label: string }[] = [
  { value: "urgent", label: "Urgent" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

export type Project = {
  id: string;
  key: string;
  name: string;
  description: string;
  status: ProjectStatus;
  sort_order: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type AuditEntityType = "project" | "issue";
export type AuditAction = "create" | "update" | "delete" | "restore";

export type AuditEntry = {
  id: string;
  entity_type: AuditEntityType;
  entity_id: string;
  action: AuditAction;
  changes: string;
  created_at: string;
};

export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  create: "생성",
  update: "수정",
  delete: "삭제",
  restore: "복구",
};

export type Issue = {
  id: string;
  project_id: string;
  type: IssueType;
  parent_id: string | null;
  title: string;
  description: string;
  status: IssueStatus;
  priority: Priority;
  sort_order: number;
  sprint_id: string | null;
  start_date: string | null;
  due_date: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type SprintState = "future" | "active" | "closed";

export const SPRINT_STATES: { value: SprintState; label: string }[] = [
  { value: "future", label: "예정" },
  { value: "active", label: "진행중" },
  { value: "closed", label: "완료" },
];

export const SPRINT_STATE_LABELS: Record<SprintState, string> = {
  future: "예정",
  active: "진행중",
  closed: "완료",
};

export type Sprint = {
  id: string;
  project_id: string;
  name: string;
  goal: string;
  state: SprintState;
  start_date: string | null;
  end_date: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  deleted_at: string | null;
};
