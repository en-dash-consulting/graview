import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  createMemoryAdapter,
  createSchema,
  defineNode,
  Graph,
  type GraphSnapshot,
  type PersistenceAdapter,
} from "../../src/index.js";
import { createSqliteAdapter } from "../../src/persistence/sqlite.js";

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

/** The household example's real table shape, so its store plugs in without a migration. */
function householdTables() {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE graph_nodes (
      household_id TEXT NOT NULL, id TEXT NOT NULL,
      kind TEXT NOT NULL, data TEXT NOT NULL,
      PRIMARY KEY (household_id, id)
    );
    CREATE TABLE graph_edges (
      household_id TEXT NOT NULL, position INTEGER NOT NULL,
      kind TEXT NOT NULL, from_id TEXT NOT NULL, to_id TEXT NOT NULL,
      PRIMARY KEY (household_id, position)
    );
  `);
  return db;
}

const adapters: [string, () => PersistenceAdapter<string>][] = [
  ["memory", () => createMemoryAdapter()],
  ["sqlite", () => createSqliteAdapter({ database: householdTables() as never })],
];

describe.each(adapters)("%s adapter", (_name, make) => {
  it("returns null before anything is stored", async () => {
    await expect(make().load("household-1")).resolves.toBeNull();
  });

  it("round-trips a graph through one interface", async () => {
    const adapter = make();
    await adapter.save("household-1", snapshot);
    const loaded = await adapter.load("household-1");
    expect(loaded).not.toBeNull();
    const graph = Graph.from(schema, loaded as never);
    expect(graph.size).toEqual({ nodes: 3, edges: 1 });
    expect(graph.getNode("p2")).toEqual({ id: "p2", kind: "person", label: "Bo", accent: "moss" });
    expect(graph.out("p1", "assigned-to").map((n) => n.id)).toEqual(["d1"]);
  });

  it("keeps scopes apart", async () => {
    const adapter = make();
    await adapter.save("household-1", snapshot);
    await adapter.save("household-2", {
      nodes: [{ id: "p9", kind: "person", label: "Solo" }],
      edges: [],
    });
    expect((await adapter.load("household-2"))?.nodes).toHaveLength(1);
    expect((await adapter.load("household-1"))?.nodes).toHaveLength(3);
    expect(await adapter.load("household-3")).toBeNull();
  });

  it("survives a write, a reload, and a second write", async () => {
    const adapter = make();
    await adapter.save("h", snapshot);
    const first = await adapter.load("h");
    const graph = Graph.from(schema, first as never);
    graph.applyPrimitives([
      { op: "patch-node", id: "d1", before: { at: 480 }, after: { at: 540 } },
    ]);
    await adapter.save("h", graph.snapshot());
    const second = await adapter.load("h");
    expect(second?.nodes.find((n) => n.id === "d1")).toMatchObject({ at: 540 });
  });

  it("deletes a scope without touching the others", async () => {
    const adapter = make();
    await adapter.save("h", snapshot);
    await adapter.save("other", snapshot);
    await adapter.delete("h");
    expect(await adapter.load("h")).toBeNull();
    expect(await adapter.load("other")).not.toBeNull();
  });

  it("appends and reloads the operation log when it supports one", async () => {
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
    expect(await adapter.loadLog("h")).toEqual([op]);
  });
});

describe("sqlite adapter", () => {
  it("keeps the id and kind columns authoritative over the JSON blob", async () => {
    const db = householdTables();
    db.prepare(
      "INSERT INTO graph_nodes (household_id, id, kind, data) VALUES (?, ?, ?, ?)",
    ).run("h", "p1", "person", JSON.stringify({ id: "stale", kind: "stale", label: "Ana" }));
    const adapter = createSqliteAdapter({ database: db as never });
    const loaded = await adapter.load("h");
    expect(loaded?.nodes[0]).toEqual({ id: "p1", kind: "person", label: "Ana" });
  });

  it("preserves edge order through the position column", async () => {
    const adapter = createSqliteAdapter({ database: householdTables() as never });
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
    expect((await adapter.load("h"))?.edges).toEqual(many.edges);
  });

  it("creates its own tables when asked", async () => {
    const adapter = createSqliteAdapter({
      database: new Database(":memory:") as never,
      createTables: true,
      scopeColumn: "scope",
    });
    await adapter.save("s", snapshot);
    expect((await adapter.load("s"))?.nodes).toHaveLength(3);
  });
});
