import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { createMemoryAdapter, type GraphSnapshot, type PersistenceAdapter } from "../../src/index.js";
import { createSqlAdapter, createSqliteAdapter, sqlFromDatabase } from "../../src/persistence/sqlite.js";
import { adapterCases, sqlCases } from "../support/adapter-contract.js";

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
  // The SQL adapter over better-sqlite3: the same `exec` a Durable Object hands it (FR-09).
  ["sql over better-sqlite3", () => createSqlAdapter(sqlFromDatabase(householdTables() as never))],
];

describe.each(adapters)("%s adapter", (_name, make) => {
  for (const contract of adapterCases(make)) it(contract.name, () => contract.run());

  // FR-23: the contract's compaction case runs only where an adapter keeps an archive; each of these does.
  it("keeps epochs and an archive, so a long-lived log can compact", () => {
    const adapter = make();
    for (const method of ["loadEpochs", "saveEpochs", "compact", "loadArchive"] as const) expect(typeof adapter[method]).toBe("function");
  });
});

describe("sql adapter over better-sqlite3", () => {
  for (const contract of sqlCases(() => sqlFromDatabase(new Database(":memory:") as never))) it(contract.name, () => contract.run());

  it("prepares a statement once, however many times it runs", async () => {
    const db = householdTables();
    let prepared = 0;
    const counting = { prepare: (sql: string) => (prepared++, db.prepare(sql)), exec: (sql: string) => db.exec(sql), transaction: db.transaction.bind(db) };
    const adapter = createSqlAdapter(sqlFromDatabase(counting as never));
    await adapter.save("h", snapshot);
    const once = prepared;
    await adapter.save("h", snapshot);
    await adapter.load("h");
    await adapter.load("h");
    expect(prepared).toBeLessThanOrEqual(once + 2);
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
