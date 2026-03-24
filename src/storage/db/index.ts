import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";

import * as schema from "./schema/index.js";

export interface StateDatabase {
  sqlite: Database.Database;
  db: ReturnType<typeof drizzle<typeof schema>>;
  schema: typeof schema;
  close(): void;
}

export function createStateDatabase(filename = "./data/state.db"): StateDatabase {
  const sqlite = new Database(filename);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("busy_timeout = 5000");

  const db = drizzle(sqlite, { schema });

  return {
    sqlite,
    db,
    schema,
    close() {
      sqlite.close();
    },
  };
}
