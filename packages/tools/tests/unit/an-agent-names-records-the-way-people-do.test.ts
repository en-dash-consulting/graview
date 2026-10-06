import { Store, type AnySchema, type GraviewApp, type Principal } from "@graview/core";
import { FIXTURES } from "@graview/core/conformance";
import { compileDocument } from "@graview/core/check";
import { describe, expect, it } from "vitest";
import { createToolRuntime } from "../../src/index.js";

/**
 * FR-33. Agents name records the way people do. "Book the florist" is one
 * call: an argument that names a record takes its label, or a unique
 * case-insensitive prefix of one, among the records the seat may see; the
 * result says which id it took; two matches come back as candidates.
 */
const vendors = FIXTURES.find((fixture) => fixture.id === "document:vendors")!;
const compiled = compileDocument(vendors.document);
if (!compiled.ok) throw new Error("the vendors fixture compiles");
const app = compiled.app as GraviewApp<AnySchema>;

const make = (extra: readonly object[] = [], policy = app.policy) =>
  new Store<AnySchema>({
    schema: app.schema,
    mutations: app.mutations ?? [],
    ...(policy ? { policy } : {}),
    snapshot: {
      nodes: [
        { id: "category:flowers", kind: "category", name: "Flowers" },
        { id: "vendor:bloom-co", kind: "vendor", name: "Bloom & Co", status: "researching", quote: 1200 },
        { id: "vendor:lens-lane", kind: "vendor", name: "Lens Lane", status: "contacted" },
        ...extra,
      ] as never,
      edges: [],
    },
  });
const agent: Principal = { kind: "agent", id: "claude", roles: ["planner"] };

describe("an act's node argument takes a label", () => {
  it("act book with id 'bloom' books vendor:bloom-co, and the result names the id it resolved", async () => {
    const store = make();
    const result = await createToolRuntime(store, { author: agent }).call("book", { id: "bloom" });
    expect(result.ok).toBe(true);
    expect(store.graph.getNode("vendor:bloom-co")).toMatchObject({ status: "booked" });
    if (!result.ok) return;
    expect(result.data).toMatchObject({ resolved: [{ argument: "id", given: "bloom", id: "vendor:bloom-co", label: "Bloom & Co" }] });
  });

  it("an id keeps working unchanged, and resolves nothing", async () => {
    const store = make();
    const result = await createToolRuntime(store, { author: agent }).call("book", { id: "vendor:lens-lane" });
    expect(result.ok).toBe(true);
    if (result.ok) expect((result.data as { resolved?: unknown }).resolved).toBeUndefined();
    expect(store.graph.getNode("vendor:lens-lane")).toMatchObject({ status: "booked" });
  });

  it("two matches refuse with both candidates listed, and nothing changes", async () => {
    const store = make([{ id: "vendor:bloom-room", kind: "vendor", name: "Bloom Room", status: "researching" }]);
    const before = store.log.length;
    const result = await createToolRuntime(store, { author: agent }).call("book", { id: "bloom" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("Bloom & Co (vendor:bloom-co)");
    expect(result.error).toContain("Bloom Room (vendor:bloom-room)");
    expect(result.candidates?.map((candidate) => candidate.id).sort()).toEqual(["vendor:bloom-co", "vendor:bloom-room"]);
    expect(store.log.length).toBe(before);
  });

  it("resolution only ever sees records the principal may see", async () => {
    const policy = {
      grants: [{ roles: "*" as const, mutations: "*" as const }],
      // Planners see every vendor; anyone else only their own.
      sees: [
        { roles: ["planner"], kinds: ["vendor"] },
        { roles: ["vendor"], kinds: ["vendor"], own: true },
      ],
    };
    const store = make([{ id: "vendor:bloom-room", kind: "vendor", name: "Bloom Room", status: "researching" }], policy);
    // Bloom Room's own seat sees one Bloom, so "bloom" is theirs — never the other's.
    const theirs = createToolRuntime(store, { author: { kind: "agent", id: "vendor:bloom-room", roles: ["vendor"] } });
    const result = await theirs.call("book", { id: "bloom" });
    expect(result.ok).toBe(true);
    expect(store.graph.getNode("vendor:bloom-room")).toMatchObject({ status: "booked" });
    expect(store.graph.getNode("vendor:bloom-co")).toMatchObject({ status: "researching" });
    // And a record it cannot see is not a candidate, by name or by id.
    const missing = await theirs.call("book", { id: "lens" });
    expect(missing.ok).toBe(false);
    if (!missing.ok) {
      expect(missing.error).not.toContain("Lens Lane");
      expect(missing.candidates ?? []).toEqual([]);
    }
  });

  it("says so on every act whose arguments name records", () => {
    const runtime = createToolRuntime(make(), { author: agent });
    const tool = runtime.definitions.find((definition) => definition.name === "book")!;
    expect(tool.description).toMatch(/takes its id or its name/);
    const make_ = runtime.definitions.find((definition) => definition.name === "add-category")!;
    expect(make_.description).not.toMatch(/takes its id or its name/);
  });
});
