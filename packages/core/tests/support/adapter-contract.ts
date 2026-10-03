import {
  createSchema,
  createSqlAdapter,
  defineNode,
  Graph,
  z,
  type GraphSnapshot,
  type PersistenceAdapter,
  type SqlExec,
  type SqlAdapterOptions,
} from "@graview/core";

/**
 * WHAT EVERY PERSISTENCE ADAPTER OWES, AS CASES THAT RUN ANYWHERE.
 *
 * The same cases run under vitest against the memory adapter, the sqlite
 * adapter and the SQL adapter over better-sqlite3 — and inside workerd,
 * against the SQL adapter over a Durable Object's own storage (FR-09). So
 * they are plain functions that throw, with no test runner and no `node:`
 * import: a case that only held in Node would not be a contract.
 */

export interface AdapterCase {
  readonly name: string;
  run(): Promise<void>;
}

/** What a SQL adapter is handed: a synchronous `exec`, and a transaction when the host has one. */
export type SqlHandle = Pick<SqlAdapterOptions, "sql" | "transaction">;

const canonical = (value: unknown): string =>
  JSON.stringify(value, (_key, inner: unknown) =>
    inner && typeof inner === "object" && !Array.isArray(inner)
      ? Object.fromEntries(Object.entries(inner as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)))
      : inner,
  );

function same(actual: unknown, expected: unknown, what: string): void {
  if (canonical(actual) !== canonical(expected)) {
    throw new Error(`${what}: expected ${canonical(expected)}, got ${canonical(actual)}`);
  }
}

function ok(condition: unknown, what: string): void {
  if (!condition) throw new Error(what);
}

const person = defineNode("person", {
  fields: z.object({ label: z.string(), accent: z.string().optional() }),
  edges: { "assigned-to": { to: ["duty"] } },
});
const duty = defineNode("duty", { fields: z.object({ label: z.string(), at: z.number() }) });
const schema = createSchema([person, duty]);

const snapshot: GraphSnapshot = {
  nodes: [
    { id: "p1", kind: "person", label: "Ana" },
    { id: "p2", kind: "person", label: "Bo", accent: "moss" },
    { id: "d1", kind: "duty", label: "Morning", at: 480 },
  ],
  edges: [{ kind: "assigned-to", from: "p1", to: "d1" }],
};

/** The household example's real table shape, so its store plugs in without a migration — one statement per call. */
export function householdTables(sql: SqlExec): void {
  sql.exec(`CREATE TABLE graph_nodes (
    household_id TEXT NOT NULL, id TEXT NOT NULL,
    kind TEXT NOT NULL, data TEXT NOT NULL,
    PRIMARY KEY (household_id, id))`);
  sql.exec(`CREATE TABLE graph_edges (
    household_id TEXT NOT NULL, position INTEGER NOT NULL,
    kind TEXT NOT NULL, from_id TEXT NOT NULL, to_id TEXT NOT NULL,
    PRIMARY KEY (household_id, position))`);
}

/** Every adapter: what a store needs of wherever it lives. */
export function adapterCases(make: () => PersistenceAdapter<string>): AdapterCase[] {
  return [
    {
      name: "returns null before anything is stored",
      async run() {
        same(await make().load("household-1"), null, "an empty store");
      },
    },
    {
      name: "round-trips a graph through one interface",
      async run() {
        const adapter = make();
        await adapter.save("household-1", snapshot);
        const loaded = await adapter.load("household-1");
        ok(loaded, "nothing came back");
        const graph = Graph.from(schema, loaded as never);
        same(graph.size, { nodes: 3, edges: 1 }, "the size");
        same(graph.getNode("p2"), { id: "p2", kind: "person", label: "Bo", accent: "moss" }, "a node");
        same(graph.out("p1", "assigned-to").map((n) => n.id), ["d1"], "an edge");
      },
    },
    {
      name: "keeps scopes apart",
      async run() {
        const adapter = make();
        await adapter.save("household-1", snapshot);
        await adapter.save("household-2", { nodes: [{ id: "p9", kind: "person", label: "Solo" }], edges: [] });
        same((await adapter.load("household-2"))?.nodes.length, 1, "the second scope");
        same((await adapter.load("household-1"))?.nodes.length, 3, "the first scope");
        same(await adapter.load("household-3"), null, "a scope never written");
      },
    },
    {
      name: "survives a write, a reload, and a second write",
      async run() {
        const adapter = make();
        await adapter.save("h", snapshot);
        const graph = Graph.from(schema, (await adapter.load("h")) as never);
        graph.applyPrimitives([{ op: "patch-node", id: "d1", before: { at: 480 }, after: { at: 540 } }]);
        await adapter.save("h", graph.snapshot());
        same((await adapter.load("h"))?.nodes.find((n) => n.id === "d1")?.["at"], 540, "the second write");
      },
    },
    {
      name: "deletes a scope without touching the others",
      async run() {
        const adapter = make();
        await adapter.save("h", snapshot);
        await adapter.save("other", snapshot);
        await adapter.delete("h");
        same(await adapter.load("h"), null, "the deleted scope");
        ok(await adapter.load("other"), "the other scope went too");
      },
    },
    {
      name: "appends and reloads the operation log when it supports one",
      async run() {
        const adapter = make();
        if (!adapter.appendOps || !adapter.loadLog) return;
        const op = {
          id: "op1",
          seq: 0,
          batch: "b1",
          author: { kind: "human" as const },
          intent: "Retime",
          mutation: null,
          primitives: [],
          inverse: [],
          reads: ["d1"],
          writes: ["d1"],
          at: "1970-01-01T00:00:00.000Z",
        };
        await adapter.appendOps("h", [op]);
        same(await adapter.loadLog("h"), [op], "the log");
        same(await adapter.loadLog("other"), [], "another scope's log");
      },
    },
  ];
}

/** The SQL adapter in particular: what its tables promise, over whatever `exec` it was handed. */
export function sqlCases(fresh: () => SqlHandle): AdapterCase[] {
  return [
    {
      name: "keeps the id and kind columns authoritative over the JSON blob",
      async run() {
        const handle = fresh();
        householdTables(handle.sql);
        handle.sql.exec(
          "INSERT INTO graph_nodes (household_id, id, kind, data) VALUES (?, ?, ?, ?)",
          "h",
          "p1",
          "person",
          JSON.stringify({ id: "stale", kind: "stale", label: "Ana" }),
        );
        const loaded = await createSqlAdapter(handle).load("h");
        same(loaded?.nodes[0], { id: "p1", kind: "person", label: "Ana" }, "the row");
      },
    },
    {
      name: "preserves edge order through the position column",
      async run() {
        const handle = fresh();
        householdTables(handle.sql);
        const adapter = createSqlAdapter(handle);
        const many: GraphSnapshot = {
          nodes: [
            { id: "p1", kind: "person", label: "Ana" },
            { id: "d1", kind: "duty", label: "A", at: 1 },
            { id: "d2", kind: "duty", label: "B", at: 2 },
          ],
          edges: [
            { kind: "assigned-to", from: "p1", to: "d2" },
            { kind: "assigned-to", from: "p1", to: "d1" },
          ],
        };
        await adapter.save("h", many);
        same((await adapter.load("h"))?.edges, many.edges, "the edges");
      },
    },
    {
      name: "creates its own tables when asked",
      async run() {
        const adapter = createSqlAdapter({ ...fresh(), createTables: true, scopeColumn: "scope" });
        await adapter.save("s", snapshot);
        same((await adapter.load("s"))?.nodes.length, 3, "the nodes");
      },
    },
    {
      name: "rewrites a snapshot whole: a node removed is gone after the next save",
      async run() {
        const adapter = createSqlAdapter({ ...fresh(), createTables: true });
        await adapter.save("h", snapshot);
        await adapter.save("h", { nodes: snapshot.nodes.filter((n) => n.id !== "p2"), edges: snapshot.edges });
        same((await adapter.load("h"))?.nodes.map((n) => n.id).sort(), ["d1", "p1"], "the nodes");
      },
    },
  ];
}
