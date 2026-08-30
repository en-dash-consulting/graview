import type { GraphEdge, GraphSnapshot, AnyGraphNode } from "../graph/types.js";
import type { Operation } from "../ops/types.js";
import type { PersistenceAdapter } from "./types.js";

/**
 * The slice of better-sqlite3 this adapter needs. Typed structurally so the
 * package never has to import the native module, and so a Drizzle app can
 * hand over its underlying client (`db.$client`) with no wrapper.
 */
export interface SqliteStatement {
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
 * the shape the household example already stores. `data` is schemaless JSON on disk and
 * becomes a typed node on the way in, validated by the schema registry when
 * the snapshot is loaded into a Graph.
 */
export function createSqliteAdapter(
  options: SqliteAdapterOptions,
): PersistenceAdapter<string> {
  const db = options.database;
  const nodeTable = options.nodeTable ?? "graph_nodes";
  const edgeTable = options.edgeTable ?? "graph_edges";
  const opTable = options.opTable ?? "graview_ops";
  const scope = options.scopeColumn ?? "household_id";

  if (options.createTables) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS ${nodeTable} (
        ${scope} TEXT NOT NULL, id TEXT NOT NULL,
        kind TEXT NOT NULL, data TEXT NOT NULL,
        PRIMARY KEY (${scope}, id)
      );
      CREATE TABLE IF NOT EXISTS ${edgeTable} (
        ${scope} TEXT NOT NULL, position INTEGER NOT NULL,
        kind TEXT NOT NULL, from_id TEXT NOT NULL, to_id TEXT NOT NULL,
        PRIMARY KEY (${scope}, position)
      );
      CREATE TABLE IF NOT EXISTS ${opTable} (
        ${scope} TEXT NOT NULL, seq INTEGER NOT NULL, data TEXT NOT NULL,
        PRIMARY KEY (${scope}, seq)
      );
    `);
  }

  const selectNodes = db.prepare(
    `SELECT id, kind, data FROM ${nodeTable} WHERE ${scope} = ?`,
  );
  const selectEdges = db.prepare(
    `SELECT kind, from_id, to_id FROM ${edgeTable} WHERE ${scope} = ? ORDER BY position ASC`,
  );
  const deleteNodes = db.prepare(`DELETE FROM ${nodeTable} WHERE ${scope} = ?`);
  const deleteEdges = db.prepare(`DELETE FROM ${edgeTable} WHERE ${scope} = ?`);
  const insertNode = db.prepare(
    `INSERT INTO ${nodeTable} (${scope}, id, kind, data) VALUES (?, ?, ?, ?)`,
  );
  const insertEdge = db.prepare(
    `INSERT INTO ${edgeTable} (${scope}, position, kind, from_id, to_id) VALUES (?, ?, ?, ?, ?)`,
  );

  /**
   * The op table is the framework's own, not the app's, so it is created on
   * demand. The node and edge tables are the app's and are never touched
   * unless `createTables` explicitly asks for them.
   */
  let opTableReady = false;
  function ensureOpTable(): void {
    if (opTableReady) return;
    db.exec(
      `CREATE TABLE IF NOT EXISTS ${opTable} (
         ${scope} TEXT NOT NULL, seq INTEGER NOT NULL, data TEXT NOT NULL,
         PRIMARY KEY (${scope}, seq)
       )`,
    );
    opTableReady = true;
  }

  const write = db.transaction(((key: string, snapshot: GraphSnapshot) => {
    deleteEdges.run(key);
    deleteNodes.run(key);
    for (const node of snapshot.nodes) {
      insertNode.run(key, node.id, node.kind, JSON.stringify(node));
    }
    snapshot.edges.forEach((edge, position) => {
      insertEdge.run(key, position, edge.kind, edge.from, edge.to);
    });
  }) as (key: string, snapshot: GraphSnapshot) => void);

  return {
    name: "sqlite",
    async load(key) {
      const nodeRows = selectNodes.all(key) as { id: string; kind: string; data: string }[];
      if (nodeRows.length === 0) return null;
      const edgeRows = selectEdges.all(key) as {
        kind: string;
        from_id: string;
        to_id: string;
      }[];
      const nodes: AnyGraphNode[] = nodeRows.map((row) => {
        const parsed = JSON.parse(row.data) as AnyGraphNode;
        // `id` and `kind` live in columns as well as the JSON blob; the
        // columns win so a row is never internally inconsistent.
        return { ...parsed, id: row.id, kind: row.kind };
      });
      const edges: GraphEdge[] = edgeRows.map((row) => ({
        kind: row.kind,
        from: row.from_id,
        to: row.to_id,
      }));
      return { nodes, edges };
    },
    async save(key, snapshot) {
      write(key, snapshot);
    },
    async delete(key) {
      deleteEdges.run(key);
      deleteNodes.run(key);
    },
    async loadLog(key) {
      ensureOpTable();
      const rows = db
        .prepare(`SELECT data FROM ${opTable} WHERE ${scope} = ? ORDER BY seq ASC`)
        .all(key) as { data: string }[];
      return rows.map((row) => JSON.parse(row.data) as Operation);
    },
    async appendOps(key, ops) {
      if (ops.length === 0) return;
      ensureOpTable();
      const insert = db.prepare(
        `INSERT OR REPLACE INTO ${opTable} (${scope}, seq, data) VALUES (?, ?, ?)`,
      );
      for (const op of ops) insert.run(key, op.seq, JSON.stringify(op));
    },
  };
}
