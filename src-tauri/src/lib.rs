use tauri_plugin_sql::{Migration, MigrationKind};

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

fn migrations() -> Vec<Migration> {
    vec![Migration {
        version: 1,
        description: "init_schema",
        sql: r#"
            -- ============================================================
            -- projects
            -- ============================================================
            CREATE TABLE projects (
                id              TEXT PRIMARY KEY,
                key             TEXT NOT NULL UNIQUE,
                name            TEXT NOT NULL,
                description     TEXT NOT NULL DEFAULT '',
                issue_counter   INTEGER NOT NULL DEFAULT 0,
                created_at      TEXT NOT NULL,
                updated_at      TEXT NOT NULL,
                deleted_at      TEXT
            );

            -- ============================================================
            -- statuses (board columns per project)
            -- ============================================================
            CREATE TABLE statuses (
                id              TEXT PRIMARY KEY,
                project_id      TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                name            TEXT NOT NULL,
                category        TEXT NOT NULL CHECK (category IN ('todo','in_progress','done')),
                sort_order      INTEGER NOT NULL DEFAULT 0,
                created_at      TEXT NOT NULL,
                updated_at      TEXT NOT NULL,
                deleted_at      TEXT
            );
            CREATE INDEX idx_statuses_project ON statuses(project_id) WHERE deleted_at IS NULL;

            -- ============================================================
            -- sprints
            -- ============================================================
            CREATE TABLE sprints (
                id              TEXT PRIMARY KEY,
                project_id      TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                name            TEXT NOT NULL,
                goal            TEXT NOT NULL DEFAULT '',
                state           TEXT NOT NULL CHECK (state IN ('future','active','closed')) DEFAULT 'future',
                start_date      TEXT,
                end_date        TEXT,
                completed_at    TEXT,
                sort_order      INTEGER NOT NULL DEFAULT 0,
                created_at      TEXT NOT NULL,
                updated_at      TEXT NOT NULL,
                deleted_at      TEXT
            );
            CREATE INDEX idx_sprints_project_state ON sprints(project_id, state) WHERE deleted_at IS NULL;

            -- ============================================================
            -- issues (epic / story / task / bug / subtask)
            -- ============================================================
            CREATE TABLE issues (
                id              TEXT PRIMARY KEY,
                project_id      TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                key             TEXT NOT NULL UNIQUE,
                type            TEXT NOT NULL CHECK (type IN ('epic','story','task','bug','subtask')),
                summary         TEXT NOT NULL,
                description     TEXT NOT NULL DEFAULT '',
                status_id       TEXT NOT NULL REFERENCES statuses(id),
                priority        TEXT NOT NULL CHECK (priority IN ('highest','high','medium','low','lowest')) DEFAULT 'medium',
                parent_id       TEXT REFERENCES issues(id) ON DELETE SET NULL,
                sprint_id       TEXT REFERENCES sprints(id) ON DELETE SET NULL,
                assignee        TEXT,
                reporter        TEXT,
                story_points    REAL,
                sort_order      INTEGER NOT NULL DEFAULT 0,
                due_date        TEXT,
                created_at      TEXT NOT NULL,
                updated_at      TEXT NOT NULL,
                deleted_at      TEXT
            );
            CREATE INDEX idx_issues_project_sprint ON issues(project_id, sprint_id) WHERE deleted_at IS NULL;
            CREATE INDEX idx_issues_status ON issues(status_id) WHERE deleted_at IS NULL;
            CREATE INDEX idx_issues_parent ON issues(parent_id) WHERE deleted_at IS NULL;
            CREATE INDEX idx_issues_backlog ON issues(project_id) WHERE sprint_id IS NULL AND deleted_at IS NULL;

            -- ============================================================
            -- labels + issue_labels (M:N)
            -- ============================================================
            CREATE TABLE labels (
                id              TEXT PRIMARY KEY,
                project_id      TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                name            TEXT NOT NULL,
                color           TEXT NOT NULL DEFAULT '#888888',
                created_at      TEXT NOT NULL,
                updated_at      TEXT NOT NULL,
                deleted_at      TEXT,
                UNIQUE (project_id, name)
            );

            CREATE TABLE issue_labels (
                issue_id        TEXT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
                label_id        TEXT NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
                PRIMARY KEY (issue_id, label_id)
            );
            CREATE INDEX idx_issue_labels_label ON issue_labels(label_id);

            -- ============================================================
            -- comments
            -- ============================================================
            CREATE TABLE comments (
                id              TEXT PRIMARY KEY,
                issue_id        TEXT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
                author          TEXT,
                body            TEXT NOT NULL,
                created_at      TEXT NOT NULL,
                updated_at      TEXT NOT NULL,
                deleted_at      TEXT
            );
            CREATE INDEX idx_comments_issue ON comments(issue_id) WHERE deleted_at IS NULL;

            -- ============================================================
            -- attachments (파일 본체는 앱 데이터 디렉토리에; 여기는 메타만)
            -- ============================================================
            CREATE TABLE attachments (
                id              TEXT PRIMARY KEY,
                issue_id        TEXT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
                filename        TEXT NOT NULL,
                path            TEXT NOT NULL,
                mime_type       TEXT,
                size            INTEGER,
                created_at      TEXT NOT NULL
            );
            CREATE INDEX idx_attachments_issue ON attachments(issue_id);

            -- ============================================================
            -- activity_log (감사/향후 동기화 보조)
            -- ============================================================
            CREATE TABLE activity_log (
                id              TEXT PRIMARY KEY,
                issue_id        TEXT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
                type            TEXT NOT NULL,
                payload         TEXT NOT NULL DEFAULT '{}',
                created_at      TEXT NOT NULL
            );
            CREATE INDEX idx_activity_issue ON activity_log(issue_id);

            -- ============================================================
            -- FTS5: issues
            -- ============================================================
            CREATE VIRTUAL TABLE issues_fts USING fts5(
                summary, description, content='issues', content_rowid='rowid'
            );
            CREATE TRIGGER issues_ai AFTER INSERT ON issues BEGIN
                INSERT INTO issues_fts(rowid, summary, description) VALUES (new.rowid, new.summary, new.description);
            END;
            CREATE TRIGGER issues_ad AFTER DELETE ON issues BEGIN
                INSERT INTO issues_fts(issues_fts, rowid, summary, description) VALUES('delete', old.rowid, old.summary, old.description);
            END;
            CREATE TRIGGER issues_au AFTER UPDATE ON issues BEGIN
                INSERT INTO issues_fts(issues_fts, rowid, summary, description) VALUES('delete', old.rowid, old.summary, old.description);
                INSERT INTO issues_fts(rowid, summary, description) VALUES (new.rowid, new.summary, new.description);
            END;

            -- ============================================================
            -- FTS5: comments
            -- ============================================================
            CREATE VIRTUAL TABLE comments_fts USING fts5(
                body, content='comments', content_rowid='rowid'
            );
            CREATE TRIGGER comments_ai AFTER INSERT ON comments BEGIN
                INSERT INTO comments_fts(rowid, body) VALUES (new.rowid, new.body);
            END;
            CREATE TRIGGER comments_ad AFTER DELETE ON comments BEGIN
                INSERT INTO comments_fts(comments_fts, rowid, body) VALUES('delete', old.rowid, old.body);
            END;
            CREATE TRIGGER comments_au AFTER UPDATE ON comments BEGIN
                INSERT INTO comments_fts(comments_fts, rowid, body) VALUES('delete', old.rowid, old.body);
                INSERT INTO comments_fts(rowid, body) VALUES (new.rowid, new.body);
            END;
        "#,
        kind: MigrationKind::Up,
    },
    Migration {
        version: 2,
        description: "reset_to_backlog_hierarchy",
        sql: r#"
            DROP TRIGGER IF EXISTS issues_ai;
            DROP TRIGGER IF EXISTS issues_ad;
            DROP TRIGGER IF EXISTS issues_au;
            DROP TRIGGER IF EXISTS comments_ai;
            DROP TRIGGER IF EXISTS comments_ad;
            DROP TRIGGER IF EXISTS comments_au;
            DROP TABLE IF EXISTS issues_fts;
            DROP TABLE IF EXISTS comments_fts;
            DROP TABLE IF EXISTS activity_log;
            DROP TABLE IF EXISTS attachments;
            DROP TABLE IF EXISTS comments;
            DROP TABLE IF EXISTS issue_labels;
            DROP TABLE IF EXISTS labels;
            DROP TABLE IF EXISTS issues;
            DROP TABLE IF EXISTS sprints;
            DROP TABLE IF EXISTS statuses;
            DROP TABLE IF EXISTS projects;

            CREATE TABLE projects (
                id           TEXT PRIMARY KEY,
                key          TEXT NOT NULL UNIQUE,
                name         TEXT NOT NULL,
                description  TEXT NOT NULL DEFAULT '',
                sort_order   INTEGER NOT NULL DEFAULT 0,
                created_at   TEXT NOT NULL,
                updated_at   TEXT NOT NULL,
                deleted_at   TEXT
            );

            CREATE TABLE issues (
                id           TEXT PRIMARY KEY,
                project_id   TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                type         TEXT NOT NULL CHECK (type IN ('epic','story','task')),
                parent_id    TEXT REFERENCES issues(id) ON DELETE CASCADE,
                title        TEXT NOT NULL,
                description  TEXT NOT NULL DEFAULT '',
                status       TEXT NOT NULL CHECK (status IN ('todo','in_progress','done')) DEFAULT 'todo',
                priority     TEXT NOT NULL CHECK (priority IN ('urgent','high','medium','low')) DEFAULT 'medium',
                sort_order   INTEGER NOT NULL DEFAULT 0,
                created_at   TEXT NOT NULL,
                updated_at   TEXT NOT NULL,
                deleted_at   TEXT
            );
            CREATE INDEX idx_issues_project_type ON issues(project_id, type) WHERE deleted_at IS NULL;
            CREATE INDEX idx_issues_parent ON issues(parent_id) WHERE deleted_at IS NULL;
            CREATE INDEX idx_issues_status ON issues(status) WHERE deleted_at IS NULL;
        "#,
        kind: MigrationKind::Up,
    },
    Migration {
        version: 3,
        description: "add_project_status",
        sql: r#"
            ALTER TABLE projects ADD COLUMN status TEXT NOT NULL DEFAULT 'active';
        "#,
        kind: MigrationKind::Up,
    },
    Migration {
        version: 4,
        description: "add_backlog_status_to_issues",
        sql: r#"
            PRAGMA foreign_keys=OFF;

            CREATE TABLE issues_new (
                id           TEXT PRIMARY KEY,
                project_id   TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                type         TEXT NOT NULL CHECK (type IN ('epic','story','task')),
                parent_id    TEXT REFERENCES issues(id) ON DELETE CASCADE,
                title        TEXT NOT NULL,
                description  TEXT NOT NULL DEFAULT '',
                status       TEXT NOT NULL CHECK (status IN ('backlog','todo','in_progress','done')) DEFAULT 'backlog',
                priority     TEXT NOT NULL CHECK (priority IN ('urgent','high','medium','low')) DEFAULT 'medium',
                sort_order   INTEGER NOT NULL DEFAULT 0,
                created_at   TEXT NOT NULL,
                updated_at   TEXT NOT NULL,
                deleted_at   TEXT
            );

            INSERT INTO issues_new (id, project_id, type, parent_id, title, description, status, priority, sort_order, created_at, updated_at, deleted_at)
            SELECT id, project_id, type, parent_id, title, description, status, priority, sort_order, created_at, updated_at, deleted_at FROM issues;

            DROP TABLE issues;
            ALTER TABLE issues_new RENAME TO issues;

            CREATE INDEX idx_issues_project_type ON issues(project_id, type) WHERE deleted_at IS NULL;
            CREATE INDEX idx_issues_parent ON issues(parent_id) WHERE deleted_at IS NULL;
            CREATE INDEX idx_issues_status ON issues(status) WHERE deleted_at IS NULL;

            PRAGMA foreign_keys=ON;
        "#,
        kind: MigrationKind::Up,
    },
    Migration {
        version: 5,
        description: "add_change_log",
        sql: r#"
            CREATE TABLE change_log (
                id           TEXT PRIMARY KEY,
                entity_type  TEXT NOT NULL CHECK (entity_type IN ('project','issue')),
                entity_id    TEXT NOT NULL,
                action       TEXT NOT NULL CHECK (action IN ('create','update','delete','restore')),
                changes      TEXT NOT NULL DEFAULT '{}',
                created_at   TEXT NOT NULL
            );
            CREATE INDEX idx_change_log_entity ON change_log(entity_type, entity_id);
            CREATE INDEX idx_change_log_created ON change_log(created_at);
        "#,
        kind: MigrationKind::Up,
    }]
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:sprint-board.db", migrations())
                .build(),
        )
        .invoke_handler(tauri::generate_handler![greet])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
