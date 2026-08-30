import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  createSchema,
  createViewRegistry,
  defineNode,
  labelOf,
  mutationToolSchema,
  nodeJsonSchema,
  nodeRef,
  SchemaError,
} from "../../src/index.js";

const person = defineNode("person", {
  fields: z.object({ label: z.string(), role: z.enum(["parent", "child"]) }),
  edges: { "assigned-to": { to: ["duty"], cardinality: "one" } },
});

const duty = defineNode("duty", {
  fields: z.object({ label: z.string(), at: z.number() }),
});

const note = defineNode("note", {
  fields: z.object({ text: z.string() }),
  edges: { about: { to: "*" } },
});

describe("createSchema", () => {
  const schema = createSchema([person, duty, note]);

  it("indexes kinds and edge kinds", () => {
    expect(schema.kinds).toEqual(["person", "duty", "note"]);
    expect(schema.edgeKinds).toEqual(["assigned-to", "about"]);
  });

  it("records where each edge may run", () => {
    expect(schema.edge("assigned-to")).toMatchObject({
      from: ["person"],
      to: ["duty"],
      cardinality: "one",
    });
    expect(schema.edgeAllowed("assigned-to", "person", "duty")).toBe(true);
    expect(schema.edgeAllowed("assigned-to", "duty", "person")).toBe(false);
    // A wildcard target accepts anything declared.
    expect(schema.edgeAllowed("about", "note", "duty")).toBe(true);
  });

  it("validates nodes against their declared fields", () => {
    expect(schema.parseNode({ id: "a", kind: "person", label: "A", role: "parent" })).toEqual({
      id: "a",
      kind: "person",
      label: "A",
      role: "parent",
    });
    expect(() => schema.parseNode({ id: "a", kind: "person", label: "A" })).toThrow();
    expect(() => schema.parseNode({ id: "a", kind: "vehicle" })).toThrow(SchemaError);
  });

  it("refuses a duplicate kind", () => {
    expect(() => createSchema([person, person])).toThrow(/Duplicate node kind/);
  });

  it("refuses an edge to an undeclared kind at runtime too", () => {
    // The same mistake is a typecheck failure; this covers schemas built
    // dynamically, where `tsc` never sees the target list.
    const orphan = defineNode("orphan", {
      fields: z.object({}),
      edges: { rides: { to: ["vehicle"] } },
    });
    expect(() => createSchema([orphan as never])).toThrow(/undeclared kind "vehicle"/);
  });
});

describe("labels", () => {
  it("falls back from an override, to a label field, to the id", () => {
    const withOverride = defineNode("x", {
      fields: z.object({ n: z.number() }),
      label: (node) => `#${node.n}`,
    });
    expect(labelOf(withOverride, { id: "x1", kind: "x", n: 7 })).toBe("#7");
    expect(labelOf(duty, { id: "d1", kind: "duty", label: "School run" })).toBe("School run");
    expect(labelOf(duty, { id: "d1", kind: "duty" })).toBe("d1");
  });
});

describe("JSON Schema generation", () => {
  it("derives a node schema from the same declaration as the types", () => {
    const json = nodeJsonSchema(person) as { properties: Record<string, unknown>; required: string[] };
    expect(Object.keys(json.properties).sort()).toEqual(["id", "kind", "label", "role"]);
    expect(json.required.sort()).toEqual(["id", "kind", "label", "role"]);
  });

  it("annotates node-ref arguments with the kinds they accept", () => {
    const tool = mutationToolSchema({
      name: "reassign",
      description: "Move a run",
      input: z.object({ dutyId: nodeRef(["duty"]), note: z.string().optional() }),
    });
    expect(tool.nodeRefs).toEqual([{ name: "dutyId", kinds: ["duty"], optional: false }]);
    const properties = (tool.inputSchema as { properties: Record<string, { description?: string }> })
      .properties;
    expect(properties["dutyId"]?.description).toContain("duty");
    expect(properties["note"]?.description).toBeUndefined();
  });
});

describe("view registry", () => {
  const schema = createSchema([person, duty, note]);

  it("resolves the exact cell first", () => {
    const views = createViewRegistry<typeof schema, string>(schema);
    views.register("person", { cardinality: "one", fidelity: "full" }, "PersonFull");
    expect(views.lookup("person", { cardinality: "one", fidelity: "full" })).toBe("PersonFull");
  });

  it("falls back across fidelity, and from many to one but never the reverse", () => {
    const views = createViewRegistry<typeof schema, string>(schema);
    views.register("person", { cardinality: "many", fidelity: "summary" }, "PeopleSummary");
    // A `one` cell may borrow the aggregate view — dull, but correct.
    expect(views.resolve("person", { cardinality: "one", fidelity: "full" })?.view).toBe(
      "PeopleSummary",
    );
    views.register("duty", { cardinality: "one", fidelity: "full" }, "DutyFull");
    // An aggregate cell must not borrow a single-node view: it would draw one
    // node where the scene asked for the group.
    expect(views.resolve("duty", { cardinality: "many", fidelity: "glyph" })).toBeUndefined();
  });
});
