import { getDb } from "./connection";
import type { Comment, Issue } from "./types";

// 사용자 입력을 FTS5 phrase("...")로 감싸 DSL(AND/OR/NOT/와일드카드 등) 해석을 차단.
function escapeFts5(input: string): string {
  return `"${input.replace(/"/g, '""')}"`;
}

export async function searchIssues(query: string, projectId?: string): Promise<Issue[]> {
  const db = await getDb();
  const match = escapeFts5(query);
  if (projectId) {
    return db.select<Issue[]>(
      `SELECT i.* FROM issues i
       JOIN issues_fts f ON f.rowid = i.rowid
       WHERE issues_fts MATCH $1
         AND i.project_id = $2
         AND i.deleted_at IS NULL
       ORDER BY rank`,
      [match, projectId],
    );
  }
  return db.select<Issue[]>(
    `SELECT i.* FROM issues i
     JOIN issues_fts f ON f.rowid = i.rowid
     WHERE issues_fts MATCH $1 AND i.deleted_at IS NULL
     ORDER BY rank`,
    [match],
  );
}

export async function searchComments(query: string): Promise<Comment[]> {
  const db = await getDb();
  const match = escapeFts5(query);
  return db.select<Comment[]>(
    `SELECT c.* FROM comments c
     JOIN comments_fts f ON f.rowid = c.rowid
     WHERE comments_fts MATCH $1 AND c.deleted_at IS NULL
     ORDER BY rank`,
    [match],
  );
}
