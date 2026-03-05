import { migrate } from "drizzle-orm/sql-js/migrator";
import { db, persistDb } from "./index.js";

export function runMigrations() {
  migrate(db, { migrationsFolder: "./drizzle/migrations" });
  persistDb();
}

// Run directly if called as script
if (import.meta.url === `file://${process.argv[1]}`) {
  runMigrations();
  console.log("Migrations complete.");
}
