import Database from "@tauri-apps/plugin-sql";

let instance: Database | null = null;

export async function getDb(): Promise<Database> {
  if (!instance) {
    instance = await Database.load("sqlite:sprint-board.db");
  }
  return instance;
}

export type Task = {
  id: number;
  title: string;
  body: string;
  status: string;
  created_at: string;
  updated_at: string;
};

export async function searchTasks(query: string): Promise<Task[]> {
  const db = await getDb();
  return db.select<Task[]>(
    `SELECT t.* FROM tasks t
     JOIN tasks_fts f ON f.rowid = t.id
     WHERE tasks_fts MATCH $1
     ORDER BY rank`,
    [query],
  );
}
