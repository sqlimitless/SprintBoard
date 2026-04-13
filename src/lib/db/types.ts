export type IssueType = "epic" | "story" | "task" | "bug" | "subtask";
export type Priority = "highest" | "high" | "medium" | "low" | "lowest";
export type SprintState = "future" | "active" | "closed";
export type StatusCategory = "todo" | "in_progress" | "done";

export type Project = {
  id: string;
  key: string;
  name: string;
  description: string;
  issue_counter: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type Status = {
  id: string;
  project_id: string;
  name: string;
  category: StatusCategory;
  sort_order: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type Sprint = {
  id: string;
  project_id: string;
  name: string;
  goal: string;
  state: SprintState;
  start_date: string | null;
  end_date: string | null;
  completed_at: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type Issue = {
  id: string;
  project_id: string;
  key: string;
  type: IssueType;
  summary: string;
  description: string;
  status_id: string;
  priority: Priority;
  parent_id: string | null;
  sprint_id: string | null;
  assignee: string | null;
  reporter: string | null;
  story_points: number | null;
  sort_order: number;
  due_date: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type Label = {
  id: string;
  project_id: string;
  name: string;
  color: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type Comment = {
  id: string;
  issue_id: string;
  author: string | null;
  body: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type Attachment = {
  id: string;
  issue_id: string;
  filename: string;
  path: string;
  mime_type: string | null;
  size: number | null;
  created_at: string;
};
