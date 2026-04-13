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
    }]
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:sprint-board.db", migrations())
                .build(),
        )
        .invoke_handler(tauri::generate_handler![greet])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
