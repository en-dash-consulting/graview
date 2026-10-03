import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createSchema, defineNode, repairPlan, Store, UNSET, validateGraph, z, type GraphFinding, type GraphSnapshot } from "../../src/index.js";
import { compileDocument, toDocument } from "../../src/document/index.js";

/**
 * FR-50. A document's `default` is applied when a record is made, never put
 * into the zod schema — hydration must not invent values. A repair still has
 * to see it: a record whose required `status` no longer fits takes the
 * declared default, rather than being removed with every other fix on it.
 */
const compiled = compileDocument(JSON.parse(readFileSync(new URL("./fixtures/vendors.gdd.json", import.meta.url), "utf8")));
if (!compiled.ok) throw new Error("the vendors fixture should compile");
const { app } = compiled;

// The shape of Graview Cloud's untidy() room (packages/room/tests/operations.test.ts).
const untidy: GraphSnapshot = {
  nodes: [
    { id: "category:venue", kind: "category", name: "Venue" },
    { id: "vendor:bloom", kind: "vendor", name: "Bloom", status: "researching" },
    // quote must be a number (optional: cleared); status must be an option (required with a default: defaulted)
    { id: "vendor:odd", kind: "vendor", name: "Odd", status: "maybe", quote: "lots" },
    // name is required and has no default: the record cannot be made to fit
    { id: "vendor:nameless", kind: "vendor", status: "booked" },
    { id: "spaceship:x", kind: "spaceship", name: "X" },
  ],
  edges: [
    { kind: "fills", from: "vendor:bloom", to: "spaceship:x" },
    // fills runs vendor → category, never the other way
    { kind: "fills", from: "category:venue", to: "vendor:bloom" },
  ],
};

const codes = (findings: readonly GraphFinding[]) => findings.map((f) => `${f.code} ${f.id}${f.detail ? ` ${f.detail}` : ""}`);

describe("a repair of a document-compiled app", () => {
  it("sets a misfit required field to the document's default, and clears an optional one, rather than removing the record", () => {
    const findings = validateGraph(app, untidy);
    expect(codes(findings)).toEqual([
      "kind-unknown spaceship:x",
      "node-shape vendor:nameless name",
      "node-shape vendor:odd quote",
      "node-shape vendor:odd status",
      "edge-disallowed fills:category:venue->vendor:bloom",
    ]);
    const odd = findings.filter((f) => f.id === "vendor:odd");
    expect(odd.map((f) => [f.detail, f.repair?.action])).toEqual([
      ["quote", "clear"],
      ["status", "coerce"],
    ]);
    expect(odd[1]!.repair!.primitives).toEqual([{ op: "patch-node", id: "vendor:odd", before: { status: "maybe" }, after: { status: "researching" } }]);

    const plan = repairPlan(findings);
    expect(plan.said).toEqual([
      "1 record of a kind this app no longer has would be removed, with their links",
      "1 field that no longer fits would be cleared",
      "1 required field would be set to its default",
      "1 record that cannot be made to fit would be removed, with their links",
      "1 link this app no longer allows would be removed",
    ]);
    expect(plan.primitives).toContainEqual({ op: "patch-node", id: "vendor:odd", before: { quote: "lots", status: "maybe" }, after: { quote: UNSET, status: "researching" } });
  });

  it("applied through the store, the record stays, patched, and the graph is clean", () => {
    const store = new Store({ schema: app.schema, mutations: [], snapshot: untidy as never, validate: false });
    store.applyPrimitives(repairPlan(store.findings()).primitives, { intent: "Repair" });
    expect(store.findings()).toEqual([]);
    const snapshot = store.snapshot();
    const odd = snapshot.nodes.find((n) => n.id === "vendor:odd")!;
    expect(odd).not.toHaveProperty("quote");
    expect(odd).toMatchObject({ status: "researching" });
    expect(snapshot.nodes.map((n) => n.id).sort()).toEqual(["category:venue", "vendor:bloom", "vendor:odd"]);
  });

  it("the compiled kind carries the document's defaults as metadata, and the zod schema still invents nothing", () => {
    const vendor = app.schema.tryDefinition("vendor")!;
    expect(vendor.defaults).toEqual({ status: "researching" });
    expect(app.schema.tryDefinition("category")!.defaults).toBeUndefined();
    expect(() => app.schema.parseNode({ id: "vendor:v", kind: "vendor", name: "V" })).toThrow();
  });

  it("a kind declared with `defaults` beside its schema writes them into the document as each field's default", () => {
    const shift = defineNode("shift", { fields: z.object({ name: z.string(), state: z.enum(["open", "taken"]) }), defaults: { state: "open" } });
    const written = toDocument({ schema: createSchema([shift]), mutations: [] } as never);
    expect(written.document?.kinds["shift"]?.fields["state"]).toMatchObject({ type: "enum", required: true, default: "open" });
  });
});
