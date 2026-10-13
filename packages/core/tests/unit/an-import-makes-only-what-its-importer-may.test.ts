import { describe, expect, it } from "vitest";
import { bindSchema, createSchema, defineNode, nodeRef, Store, z, type AnySchema, type Policy, type Principal } from "../../src/index.js";
import { importRows } from "../../src/import/index.js";

/**
 * AN IMPORT MAKES ONLY WHAT ITS IMPORTER MAY (FR-177, FR-55). A row is a
 * record and the links its cells name, and the importer was asked only
 * whether they may make the record: a helper who may add a vendor but not
 * book one for an event booked fifty from a sheet's Event column, and an
 * own-end grant ("you, on your own end") was never asked of a link at all.
 * Each link is now asked of the acts that make it, as a press on one would
 * be. And the id a row's record gets says nothing of a record the importer
 * may not see: it is minted as the importer's own acts mint one.
 */
const vendor = defineNode("vendor", {
  label: (node) => node.name,
  fields: z.object({ name: z.string() }),
  edges: { serves: { to: ["event"] }, keptBy: { to: ["person"], cardinality: "one" }, tagged: { to: ["tag"] } },
  plural: "Vendors",
});
const event = defineNode("event", { label: (node) => node.name, fields: z.object({ name: z.string() }), plural: "Events" });
const person = defineNode("person", { label: (node) => node.name, fields: z.object({ name: z.string() }), plural: "People" });
const tag = defineNode("tag", { label: (node) => node.name, fields: z.object({ name: z.string() }), plural: "Tags" });
const schema = createSchema([vendor, event, person, tag]);
const { defineMutation } = bindSchema(schema);

const addVendor = defineMutation("add-vendor", {
  title: "Add a vendor",
  creates: ["vendor"],
  input: z.object({ name: z.string() }),
  apply(ctx, args) {
    ctx.addNode({ id: ctx.freshId(args.name, "vendor"), kind: "vendor", name: args.name });
  },
});
const book = defineMutation("book", {
  title: "Book for an event",
  subject: { kinds: ["vendor"], arg: "id" },
  connects: ["serves"],
  input: z.object({ id: nodeRef(["vendor"]), to: nodeRef(["event"]) }),
  apply(ctx, args) {
    ctx.addEdge({ kind: "serves", from: args.id, to: args.to });
  },
});
const keep = defineMutation("keep", {
  title: "Keep the vendor",
  subject: { kinds: ["vendor"], arg: "id" },
  connects: ["keptBy"],
  input: z.object({ id: nodeRef(["vendor"]), to: nodeRef(["person"]) }),
  apply(ctx, args) {
    ctx.setSingleSource("keptBy", args.to, args.id);
  },
});

const policy: Policy = {
  roles: ["planner", "helper"],
  grants: [
    { roles: ["planner"], mutations: "*" },
    { roles: ["helper"], mutations: ["add-vendor"] },
    // A helper keeps a vendor for themself, and nobody else.
    { roles: ["helper"], mutations: ["keep"], ownEnd: true },
  ],
  sees: [
    { roles: ["planner"], kinds: ["vendor", "event", "person", "tag"] },
    { roles: ["helper"], kinds: ["event", "person", "tag"] },
    { roles: ["helper"], kinds: ["vendor"], own: true },
  ],
};
const planner: Principal = { kind: "human", id: "person:maya", roles: ["planner"] };
const helper: Principal = { kind: "human", id: "person:jo", roles: ["helper"] };

function world(hidden = false): Store<AnySchema> {
  return new Store<AnySchema>({
    schema: schema as unknown as AnySchema,
    mutations: [addVendor, book, keep] as never,
    policy,
    snapshot: {
      nodes: [
        { id: "event:smith", kind: "event", name: "Smith wedding" },
        { id: "person:maya", kind: "person", name: "Maya" },
        { id: "person:jo", kind: "person", name: "Jo" },
        { id: "tag:local", kind: "tag", name: "Local" },
        ...(hidden ? [{ id: "vendor:bloom-co", kind: "vendor", name: "Bloom & Co" }] : []),
      ],
      edges: [],
    } as never,
  });
}

describe("an import makes only what its importer may", () => {
  it("links a row to an event only for an importer who may book a vendor for one", () => {
    const sheet = [["Name", "Event"], ["Bloom & Co", "Smith wedding"]];
    const mapping = { Name: "name", Event: "serves" };
    const refused = importRows(world(), "vendor", sheet, mapping, { by: helper });
    expect(refused.made).toBe(0);
    expect(refused.rows[0]!.refused).toEqual(["Not permitted: “Book for an event” on a vendor — a planner can."]);
    // The same row without the link is the helper's to make.
    expect(importRows(world(), "vendor", [["Name"], ["Bloom & Co"]], { Name: "name" }, { by: helper }).made).toBe(1);
    // And the planner, who may book one, makes both.
    const store = world();
    const made = importRows(store, "vendor", sheet, mapping, { by: planner });
    expect(made.made).toBe(1);
    expect(store.graph.out(made.rows[0]!.id!, "serves").map((one) => one.id)).toEqual(["event:smith"]);
  });

  it("holds a link an own-end grant allows to the importer's own end", () => {
    const sheet = [["Name", "Kept by"], ["Bloom & Co", "Jo"], ["Petal Press", "Maya"]];
    const result = importRows(world(), "vendor", sheet, { Name: "name", "Kept by": "keptBy" }, { by: helper });
    expect(result.rows.map((row) => row.made)).toEqual([true, false]);
    expect(result.rows[1]!.refused).toEqual(["Not permitted: “Keep the vendor” on a vendor — only on your own end of the link."]);
  });

  it("makes no link of a relation no act makes, where a policy is declared", () => {
    const result = importRows(world(), "vendor", [["Name", "Tags"], ["Bloom & Co", "Local"]], { Name: "name", Tags: "tagged" }, { by: planner });
    expect(result.made).toBe(0);
    expect(result.rows[0]!.refused).toEqual(["nothing in this app links a vendor to a tag that way, so none can be imported"]);
  });

  it("gives a record the id the importer's own act would, the same whether a vendor it may not see is called the same", () => {
    const ids = [true, false].map((hidden) => importRows(world(hidden), "vendor", [["Name"], ["Bloom & Co"]], { Name: "name" }, { by: helper }).rows[0]!.id);
    expect(ids[0]).toBe(ids[1]);
    expect(ids[0]).toBe(world().apply({ name: "add-vendor", args: { name: "Bloom & Co" } }, { author: helper }).writes[0]);
    // The planner, who sees every vendor, steps past the one there.
    expect(importRows(world(true), "vendor", [["Name"], ["Bloom & Co"]], { Name: "name" }, { by: planner }).rows[0]!.id).toBe("vendor:bloom-co-2");
  });
});
