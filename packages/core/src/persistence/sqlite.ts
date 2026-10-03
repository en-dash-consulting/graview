import { createSqlAdapter, type SqlExec } from "./sql.js";
import type { PersistenceAdapter } from "./types.js";

export { createSqlAdapter } from "./sql.js";
export type { SqlAdapterOptions, SqlExec } from "./sql.js";

/**
 * The slice of better-sqlite3 this adapter needs. Typed structurally so the
 * package never has to import the native module, and so a Drizzle app can
 * hand over its underlying client (`db.$client`) with no wrapper.
 */
export interface SqliteStatement {
  /** Whether the statement returns rows; better-sqlite3 says, and a statement that does not is `run`. */
  readonly reader?: boolean;
  all(...params: unknown[]): unknown[];
  run(...params: unknown[]): unknown;
}
export interface SqliteDatabase {
  prepare(sql: string): SqliteStatement;
  exec(sql: string): unknown;
  transaction<T extends (...args: never[]) => unknown>(fn: T): T;
}

export interface SqliteAdapterOptions {
  readonly database: SqliteDatabase;
  /** Defaults match the household example's existing tables exactly. */
  readonly nodeTable?: string;
  readonly edgeTable?: string;
  readonly opTable?: string;
  /** Column holding the scope key (the household example: `household_id`). */
  readonly scopeColumn?: string;
  /** Creates the tables when absent. Off by default: never touch an app's schema. */
  readonly createTables?: boolean;
}

/**
 * The Drizzle/SQLite table shapes this adapter reads and writes, for an app
 * that wants to declare them in its own Drizzle schema:
 *
 * ```ts
 * export const graphNodes = sqliteTable("graph_nodes", {
 *   householdId: text("household_id").notNull(),
 *   id: text("id").notNull(),
 *   kind: text("kind").notNull(),
 *   data: text("data").notNull(),
 * }, (t) => [primaryKey({ columns: [t.householdId, t.id] })]);
 *
 * export const graphEdges = sqliteTable("graph_edges", {
 *   householdId: text("household_id").notNull(),
 *   position: integer("position").notNull(),
 *   kind: text("kind").notNull(),
 *   fromId: text("from_id").notNull(),
 *   toId: text("to_id").notNull(),
 * }, (t) => [primaryKey({ columns: [t.householdId, t.position] })]);
 * ```
 */
export const SQLITE_TABLE_SHAPE = {
  nodes: ["scope", "id", "kind", "data"],
  edges: ["scope", "position", "kind", "from_id", "to_id"],
} as const;

/**
 * Reads and writes an app's existing `graph_nodes` / `graph_edges` tables —
 * the shape the household example already stores — through better-sqlite3.
 * The SQL adapter over `sqlFromDatabase(database)`: one implementation, so
 * what holds here holds over a Durable Object's storage too (FR-09).
 */
export function createSqliteAdapter(options: SqliteAdapterOptions): PersistenceAdapter<string> {
  const { database, ...tables } = options;
  return createSqlAdapter({ ...sqlFromDatabase(database), ...tables });
}

/**
 * better-sqlite3 as the SQL adapter's `exec`, with its own transaction.
 * Each statement is prepared once and kept, and a statement that reads
 * nothing is `run` rather than asked for rows (better-sqlite3 refuses that).
 */
export function sqlFromDatabase(database: SqliteDatabase): { readonly sql: SqlExec; readonly transaction: <T>(fn: () => T) => T } {
  const prepared = new Map<string, SqliteStatement>();
  const statement = (sql: string): SqliteStatement => {
    let found = prepared.get(sql);
    if (!found) {
      found = database.prepare(sql);
      prepared.set(sql, found);
    }
    return found;
  };
  return {
    sql: {
      exec(sql, ...params) {
        const prepared = statement(sql);
        const reads = prepared.reader ?? /^\s*(SELECT|WITH|PRAGMA|VALUES)\b/i.test(sql);
        if (reads) return prepared.all(...params);
        prepared.run(...params);
        return [];
      },
    },
    transaction: <T>(fn: () => T): T => database.transaction(fn as () => T)() as T,
  };
}
