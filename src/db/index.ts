import { drizzle } from "drizzle-orm/sql-js";
import initSqlJs from "sql.js";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "fs";
import { dirname } from "path";
import { config } from "../config.js";
import * as schema from "./schema.js";

const dbPath = config.databasePath;
mkdirSync(dirname(dbPath), { recursive: true });

const SQL = await initSqlJs();
const existingData = existsSync(dbPath) ? readFileSync(dbPath) : undefined;
const sqlite = existingData ? new SQL.Database(existingData) : new SQL.Database();

export const db = drizzle(sqlite, { schema });
export { sqlite };

export function persistDb() {
  const data = sqlite.export();
  writeFileSync(dbPath, Buffer.from(data));
}

export function withTransaction<T>(fn: () => T): T {
  sqlite.run("BEGIN");
  try {
    const result = fn();
    sqlite.run("COMMIT");
    persistDb();
    return result;
  } catch (e) {
    sqlite.run("ROLLBACK");
    throw e;
  }
}

// Auto-save on process exit
process.on("exit", persistDb);
process.on("SIGINT", () => { persistDb(); process.exit(0); });
process.on("SIGTERM", () => { persistDb(); process.exit(0); });
