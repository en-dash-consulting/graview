import type { GraphEdge, GraphSnapshot, AnyGraphNode } from "../graph/types.js";
import type { Operation } from "../ops/types.js";
import type { PersistenceAdapter } from "./types.js";

/**
 * PERSISTENCE OVER PLAIN SQL — one synchronous `exec` (FR-09).
 *
 * The shape a Durable Object's storage already has (`ctx.storage.sql`
 * passes as it is) and better-sqlite3 has once `sqlFromDatabase` wraps it:
 * one statement in, its rows out. Nothing else is asked of the database, so
 * the adapter runs wherever SQLite does — a Worker, Node, Deno — and no
 * native module is ever imported here.
 */
export interface SqlExec {
  /** Runs ONE statement with `?` parameters; the rows, iterable, when it reads any. */
  exec(sql: string, ...params: unknown[]): Iterable<unknown>;
}

export interface SqlAdapterOptions {
  readonly sql: SqlExec;
  /**
   * Runs `fn` as one transaction, so a snapshot is rewritten all or nothing.
   * A Durable Object passes `(fn) => ctx.storage.transactionSync(fn)`;
   * `sqlFromDatabase` supplies better-sqlite3's. Absent, `fn` simply runs.
   */
  readonly transaction?: <T>(fn: () => T) => T;
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
 * Reads and writes an app's `graph_nodes` / `graph_edges` tables, and the
 * framework's own op table, through `exec` alone. `data` is schemaless JSON
 * on disk and becomes a typed node on the way in, validated by the schema
 * registry when the snapshot is loaded into a Graph.
 */
export function createSqlAdapter(options: SqlAdapterOptions): PersistenceAdapter<string> {
  const { sql } = options;
  const transaction = options.transaction ?? (<T>(fn: () => T): T => fn());
  const nodeTable = options.nodeTable ?? "graph_nodes";
  const edgeTable = options.edgeTable ?? "graph_edges";
  const opTable = options.opTable ?? "graview_ops";
  const scope = options.scopeColumn ?? "household_id";
  const rows = <T>(statement: string, ...params: unknown[]): T[] => [...sql.exec(statement, ...params)] as T[];
  const run = (statement: string, ...params: unknown[]): void => {
    // Drained, so a lazy cursor (a Durable Object's) has really run.
    for (const _ of sql.exec(statement, ...params)) void _;
  };

  const createOpTable = `CREATE TABLE IF NOT EXISTS ${opTable} (
    ${scope} TEXT NOT NULL, seq INTEGER NOT NULL, data TEXT NOT NULL,
    PRIMARY KEY (${scope}, seq))`;

  if (options.createTables) {
    run(`CREATE TABLE IF NOT EXISTS ${nodeTable} (
      ${scope} TEXT NOT NULL, id TEXT NOT NULL,
      kind TEXT NOT NULL, data TEXT NOT NULL,
      PRIMARY KEY (${scope}, id))`);
    run(`CREATE TABLE IF NOT EXISTS ${edgeTable} (
      ${scope} TEXT NOT NULL, position INTEGER NOT NULL,
      kind TEXT NOT NULL, from_id TEXT NOT NULL, to_id TEXT NOT NULL,
      PRIMARY KEY (${scope}, position))`);
    run(createOpTable);
  }

  /**
   * The op table is the framework's own, not the app's, so it is created on
   * demand. The node and edge tables are the app's and are never touched
   * unless `createTables` explicitly asks for them.
   */
  let opTableReady = false;
  function ensureOpTable(): void {
    if (opTableReady) return;
    run(createOpTable);
    opTableReady = true;
  }

  const clear = (key: string) => {
    run(`DELETE FROM ${edgeTable} WHERE ${scope} = ?`, key);
    run(`DELETE FROM ${nodeTable} WHERE ${scope} = ?`, key);
  };

  return {
    name: "sqlite",
    async load(key) {
      const nodeRows = rows<{ id: string; kind: string; data: string }>(`SELECT id, kind, data FROM ${nodeTable} WHERE ${scope} = ?`, key);
      if (nodeRows.length === 0) return null;
      const edgeRows = rows<{ kind: string; from_id: string; to_id: string }>(
        `SELECT kind, from_id, to_id FROM ${edgeTable} WHERE ${scope} = ? ORDER BY position ASC`,
        key,
      );
      const nodes: AnyGraphNode[] = nodeRows.map((row) => {
        const parsed = JSON.parse(row.data) as AnyGraphNode;
        // `id` and `kind` live in columns as well as the JSON blob; the
        // columns win so a row is never internally inconsistent.
        return { ...parsed, id: row.id, kind: row.kind };
      });
      const edges: GraphEdge[] = edgeRows.map((row) => ({ kind: row.kind, from: row.from_id, to: row.to_id }));
      return { nodes, edges };
    },
    async save(key, snapshot: GraphSnapshot) {
      transaction(() => {
        clear(key);
        for (const node of snapshot.nodes) {
          run(`INSERT INTO ${nodeTable} (${scope}, id, kind, data) VALUES (?, ?, ?, ?)`, key, node.id, node.kind, JSON.stringify(node));
        }
        snapshot.edges.forEach((edge, position) => {
          run(`INSERT INTO ${edgeTable} (${scope}, position, kind, from_id, to_id) VALUES (?, ?, ?, ?, ?)`, key, position, edge.kind, edge.from, edge.to);
        });
      });
    },
    async delete(key) {
      transaction(() => clear(key));
    },
    async loadLog(key) {
      ensureOpTable();
      return rows<{ data: string }>(`SELECT data FROM ${opTable} WHERE ${scope} = ? ORDER BY seq ASC`, key).map(
        (row) => JSON.parse(row.data) as Operation,
      );
    },
    async appendOps(key, ops) {
      if (ops.length === 0) return;
      ensureOpTable();
      transaction(() => {
        for (const op of ops) run(`INSERT OR REPLACE INTO ${opTable} (${scope}, seq, data) VALUES (?, ?, ?)`, key, op.seq, JSON.stringify(op));
      });
    },
  };
}
