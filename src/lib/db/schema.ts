import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import type {
  AuditAction,
  AuditEntityType,
  IssueStatus,
  IssueType,
  Priority,
  ProjectStatus,
} from "./types";

export const change_log = sqliteTable(
  "change_log",
  {
    id: text("id").primaryKey(),
    entity_type: text("entity_type").notNull().$type<AuditEntityType>(),
    entity_id: text("entity_id").notNull(),
    action: text("action").notNull().$type<AuditAction>(),
    changes: text("changes").notNull().default("{}"),
    created_at: text("created_at").notNull(),
  },
  (t) => ({
    byEntity: index("idx_change_log_entity").on(t.entity_type, t.entity_id),
  }),
);

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  status: text("status").notNull().$type<ProjectStatus>().default("active"),
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
    type: text("type").notNull().$type<IssueType>(),
    parent_id: text("parent_id"),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    status: text("status").notNull().$type<IssueStatus>().default("backlog"),
    priority: text("priority").notNull().$type<Priority>().default("medium"),
    sort_order: integer("sort_order").notNull().default(0),
    created_at: text("created_at").notNull(),
    updated_at: text("updated_at").notNull(),
    deleted_at: text("deleted_at"),
  },
  (t) => ({
    byProjectType: index("idx_issues_project_type").on(t.project_id, t.type),
    byParent: index("idx_issues_parent").on(t.parent_id),
    byStatus: index("idx_issues_status").on(t.status),
  }),
);
