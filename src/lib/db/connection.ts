import Database from "@tauri-apps/plugin-sql";
import { drizzle, type SqliteRemoteDatabase } from "drizzle-orm/sqlite-proxy";
import * as schema from "./schema";

let rawDb: Database | null = null;

async function getRaw(): Promise<Database> {
  if (!rawDb) {
    rawDb = await Database.load("sqlite:sprint-board.db");
  }
  return rawDb;
}

export async function getDb(): Promise<Database> {
  return getRaw();
}

export const orm: SqliteRemoteDatabase<typeof schema> = drizzle(
  async (sqlStr, params, method) => {
    const db = await getRaw();

    if (method === "run") {
      await db.execute(sqlStr, params);
      return { rows: [] };
    }

    // tauri-plugin-sql는 row를 { column: value } 객체로 돌려준다.
    // sqlite-proxy는 column 순서의 값 배열을 기대하므로 Object.values로 변환.
    // (SQLite 드라이버는 SELECT 컬럼 순서대로 객체를 채우고, JS는 삽입 순서를 보존.)
    const rows = await db.select<Record<string, unknown>[]>(sqlStr, params);
    const valueRows = rows.map((r) => Object.values(r));

    if (method === "get") {
      return { rows: valueRows[0] ?? [] };
    }
    return { rows: valueRows };
  },
  { schema, logger: false },
);

export function nowIso(): string {
  return new Date().toISOString();
}

export function newId(): string {
  return crypto.randomUUID();
}
