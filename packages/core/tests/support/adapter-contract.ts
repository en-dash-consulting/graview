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
    {
      // One writer, enforced: an append names the head it expects, and one that finds the log moved appends nothing.
      name: "refuses the second of two writers appending at the same head, and appends nothing of it",
      async run() {
        const adapter = make();
        if (!adapter.appendOps || !adapter.loadLog) return;
        const op = (seq: number, by: string) => ({
          id: `${by}-${seq}`,
          seq,
          batch: `${by}:${seq}`,
          author: { kind: "human" as const, id: by },
          intent: `Retime by ${by}`,
          mutation: null,
          primitives: [{ op: "patch-node" as const, id: "d1", before: { at: 480 }, after: { at: 540 } }],
          reads: ["d1"],
          writes: ["d1"],
          at: "1970-01-01T00:00:00.000Z",
        });
        await adapter.appendOps("h", [op(0, "ana")], { head: 0 });
        await adapter.appendOps("h", [op(1, "ana")], { head: 1 });
        // Bo opened the log when it was one op long and appends after Ana did.
        let refused: unknown;
        try {
          await adapter.appendOps("h", [op(1, "bo")], { head: 1 });
        } catch (error) {
          refused = error;
        }
        ok(refused instanceof Error && refused.name === "LogHeadMovedError", `the second writer was not refused: ${String(refused)}`);
        same((refused as { expected: number; found: number }).found, 2, "the head the second writer found");
        same((await adapter.loadLog("h")).map((one) => one.id), ["ana-0", "ana-1"], "the log after the refusal");
        // At the head it holds, the writer goes on; without a head, an append is not checked, as before.
        await adapter.appendOps("h", [op(2, "bo")], { head: 2 });
        same((await adapter.loadLog("h")).map((one) => one.id), ["ana-0", "ana-1", "bo-2"], "the log after an append at its head");
        await adapter.appendOps("other", [op(0, "cy")], { head: 0 });
        same((await adapter.loadLog("other")).map((one) => one.id), ["cy-0"], "another scope begins at 0");
      },
    },
    {
      // FR-23: a normal open loads the checkpoint and the tail; the archive holds the rest.
      name: "moves the ops and epochs behind a checkpoint into its archive when it compacts",
      async run() {
        const adapter = make();
        if (!adapter.compact || !adapter.loadArchive || !adapter.appendOps || !adapter.loadLog || !adapter.saveEpochs || !adapter.loadEpochs) return;
        const ops = [0, 1, 2, 3, 4].map((seq) => ({
          id: `op${seq + 1}`,
          seq,
          batch: `b${seq + 1}`,
          author: { kind: "human" as const },
          intent: `Retime ${seq}`,
          mutation: null,
          primitives: [{ op: "patch-node" as const, id: "d1", before: { at: 480 + seq }, after: { at: 481 + seq } }],
          inverse: [{ op: "patch-node" as const, id: "d1", before: { at: 481 + seq }, after: { at: 480 + seq } }],
          reads: ["d1"],
          writes: ["d1"],
          at: "1970-01-01T00:00:00.000Z",
        }));
        const seed = { seq: 0, base: snapshot };
        const later = { seq: 4, base: snapshot, version: 2, change: "a change" };
        await adapter.appendOps("h", ops.slice(0, 2));
        await adapter.appendOps("h", ops.slice(2));
        await adapter.saveEpochs("h", [seed, later]);
        const checkpoint = { seq: 3, base: snapshot, horizon: true as const };
        await adapter.compact("h", checkpoint);
        same((await adapter.loadLog("h")).map((op) => op.seq), [3, 4], "the tail");
        same(await adapter.loadEpochs("h"), [checkpoint, later], "the checkpoint and the epochs after it");
        const archive = await adapter.loadArchive("h");
        same(archive.ops, ops.slice(0, 3), "the archived ops");
        same(archive.epochs, [seed], "the archived epochs");
        // Again, behind a later horizon: the archive grows, in order.
        const next = { seq: 4, base: snapshot, version: 2, change: "a change", horizon: true as const };
        await adapter.compact("h", next);
        same((await adapter.loadLog("h")).map((op) => op.seq), [4], "the second tail");
        same(await adapter.loadEpochs("h"), [next], "the second checkpoint");
        same((await adapter.loadArchive("h")).ops.map((op) => op.seq), [0, 1, 2, 3], "the archive after two");
        same((await adapter.loadArchive("h")).epochs, [seed, checkpoint], "the archived epochs after two");
        same(await adapter.loadArchive("other"), { ops: [], epochs: [] }, "another scope's archive");
        // The head of a compacted log is one past its tail: an append there lands, one behind it does not.
        let behind: unknown;
        try {
          await adapter.appendOps("h", [{ ...ops[4]!, id: "late", seq: 4 }], { head: 4 });
        } catch (error) {
          behind = error;
        }
        ok(behind instanceof Error && behind.name === "LogHeadMovedError", "an append behind a compacted log's head was not refused");
        await adapter.appendOps("h", [{ ...ops[4]!, id: "next", seq: 5 }], { head: 5 });
        same((await adapter.loadLog("h")).map((op) => op.seq), [4, 5], "the tail after an append at its head");
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
    {
      name: "keeps a link's own id and data in the edge table's data column",
      async run() {
        const adapter = createSqlAdapter({ ...fresh(), createTables: true });
        const linked: GraphSnapshot = { nodes: snapshot.nodes, edges: [{ kind: "assigned-to", from: "p1", to: "d1", id: "shift-1", data: { hours: 4 } }, { kind: "assigned-to", from: "p2", to: "d1" }] };
        await adapter.save("h", linked);
        same((await adapter.load("h"))?.edges, linked.edges, "the edges");
      },
    },
    {
      name: "an edge table made before the data column reads links as before, refuses one with an id, and gains the column when asked to make its tables",
      async run() {
        const handle = fresh();
        householdTables(handle.sql);
        const plain = createSqlAdapter(handle);
        await plain.save("h", snapshot);
        same((await plain.load("h"))?.edges, snapshot.edges, "a plain link");
        const linked: GraphSnapshot = { nodes: snapshot.nodes, edges: [{ kind: "assigned-to", from: "p1", to: "d1", id: "shift-1" }] };
        let refused = false;
        try {
          await plain.save("h", linked);
        } catch (error) {
          refused = /no "data" column/.test(String(error));
        }
        ok(refused, "a link with an id is refused where it cannot be kept");
        const made = createSqlAdapter({ ...handle, createTables: true });
        await made.save("h", linked);
        same((await made.load("h"))?.edges, linked.edges, "the link, with its id");
      },
    },
  ];
}
