import {
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import type {
  IssueType,
  Priority,
  SprintState,
  StatusCategory,
} from "./types";

// 컬럼명은 SQL snake_case 그대로 유지. sqlite-proxy 드라이버가 Object.values로
// 컬럼 순서를 보존하므로 JS 속성명도 snake_case로 맞춰 types.ts 호환성 유지.

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  issue_counter: integer("issue_counter").notNull().default(0),
  created_at: text("created_at").notNull(),
  updated_at: text("updated_at").notNull(),
  deleted_at: text("deleted_at"),
});

export const statuses = sqliteTable("statuses", {
  id: text("id").primaryKey(),
  project_id: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  category: text("category").notNull().$type<StatusCategory>(),
  sort_order: integer("sort_order").notNull().default(0),
  created_at: text("created_at").notNull(),
  updated_at: text("updated_at").notNull(),
  deleted_at: text("deleted_at"),
});

export const sprints = sqliteTable("sprints", {
  id: text("id").primaryKey(),
  project_id: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  goal: text("goal").notNull().default(""),
  state: text("state").notNull().$type<SprintState>().default("future"),
  start_date: text("start_date"),
  end_date: text("end_date"),
  completed_at: text("completed_at"),
  sort_order: integer("sort_order").notNull().default(0),
  created_at: text("created_at").notNull(),
  updated_at: text("updated_at").notNull(),
  deleted_at: text("deleted_at"),
});

export const issues = sqliteTable(
  "issues",
  {
    id: text("id").primaryKey(),
    project_id: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    key: text("key").notNull().unique(),
    type: text("type").notNull().$type<IssueType>(),
    summary: text("summary").notNull(),
    description: text("description").notNull().default(""),
    status_id: text("status_id")
      .notNull()
      .references(() => statuses.id),
    priority: text("priority").notNull().$type<Priority>().default("medium"),
    parent_id: text("parent_id"),
    sprint_id: text("sprint_id").references(() => sprints.id, {
      onDelete: "set null",
    }),
    assignee: text("assignee"),
    reporter: text("reporter"),
    story_points: real("story_points"),
    sort_order: integer("sort_order").notNull().default(0),
    due_date: text("due_date"),
    created_at: text("created_at").notNull(),
    updated_at: text("updated_at").notNull(),
    deleted_at: text("deleted_at"),
  },
  (t) => ({
    byProjectSprint: index("idx_issues_project_sprint").on(
      t.project_id,
      t.sprint_id,
    ),
    byStatus: index("idx_issues_status").on(t.status_id),
    byParent: index("idx_issues_parent").on(t.parent_id),
  }),
);

export const labels = sqliteTable(
  "labels",
  {
    id: text("id").primaryKey(),
    project_id: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    color: text("color").notNull().default("#888888"),
    created_at: text("created_at").notNull(),
    updated_at: text("updated_at").notNull(),
    deleted_at: text("deleted_at"),
  },
  (t) => ({
    uqProjectName: uniqueIndex("uq_labels_project_name").on(t.project_id, t.name),
  }),
);

export const issue_labels = sqliteTable(
  "issue_labels",
  {
    issue_id: text("issue_id")
      .notNull()
      .references(() => issues.id, { onDelete: "cascade" }),
    label_id: text("label_id")
      .notNull()
      .references(() => labels.id, { onDelete: "cascade" }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.issue_id, t.label_id] }),
  }),
);

export const comments = sqliteTable("comments", {
  id: text("id").primaryKey(),
  issue_id: text("issue_id")
    .notNull()
    .references(() => issues.id, { onDelete: "cascade" }),
  author: text("author"),
  body: text("body").notNull(),
  created_at: text("created_at").notNull(),
  updated_at: text("updated_at").notNull(),
  deleted_at: text("deleted_at"),
});

export const attachments = sqliteTable("attachments", {
  id: text("id").primaryKey(),
  issue_id: text("issue_id")
    .notNull()
    .references(() => issues.id, { onDelete: "cascade" }),
  filename: text("filename").notNull(),
  path: text("path").notNull(),
  mime_type: text("mime_type"),
  size: integer("size"),
  created_at: text("created_at").notNull(),
});

export const activity_log = sqliteTable("activity_log", {
  id: text("id").primaryKey(),
  issue_id: text("issue_id")
    .notNull()
    .references(() => issues.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  payload: text("payload").notNull().default("{}"),
  created_at: text("created_at").notNull(),
});
