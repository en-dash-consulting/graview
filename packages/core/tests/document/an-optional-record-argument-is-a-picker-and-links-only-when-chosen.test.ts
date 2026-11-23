import { describe, expect, it } from "vitest";
import { toJSONSchema } from "zod";
import { checkApp, compileDocument } from "../../src/check.js";
import { describeActForm, formLines } from "../../src/document/describe-forms.js";
import { formFields } from "../../src/forms.js";
import { Store, type AnySchema, type GraviewApp } from "../../src/index.js";

/**
 * AN OPTIONAL RECORD ARGUMENT IS A PICKER, AND LINKS ONLY WHEN CHOSEN
 * (Roadmap f-optional-record-input-in-create). A Thanksgiving app's "Add a
 * dish" made the dish and connected it to `$to`, the household bringing
 * it. Declaring `"to": { "type": "string", "required": false }` drew a
 * text box, and leaving it empty refused the act with 'there is no record
 * ""'; `{ "required": false }` alone was refused for saying no type. An
 * argument naming a record now says only whether it may be left out: it
 * is drawn as a picker with an empty choice, and the link is made only
 * when a record is chosen. One said with a type is still that field — a
 * template's act asks for its record that way — and left empty, its link
 * is skipped too rather than refused.
 */
const thanksgiving = (to: Record<string, unknown>) => ({
  format: "graview-document",
  formatVersion: 1,
  name: "Thanksgiving",
  kinds: {
    household: { label: "{name}", fields: { name: { type: "string", required: true } } },
    dish: {
      label: "{name}",
      fields: { name: { type: "string", required: true }, photo: { type: "image" } },
      edges: { broughtBy: { to: ["household"], cardinality: "one", inverse: "the dishes it brings" } },
    },
  },
  acts: {
    "add-dish": {
      title: "Add a dish",
      args: { to },
      effects: [
        { create: "dish", as: "new", set: { name: "$name", photo: "$photo" } },
        { connect: "broughtBy", from: "$new", to: "$to" },
      ],
    },
  },
});

const compiled = (to: Record<string, unknown>) => {
  const result = compileDocument(thanksgiving(to));
  if (!result.ok) throw new Error(`the document compiles: ${JSON.stringify(result.findings.filter((f) => f.severity === "error"))}`);
  return result.app as GraviewApp<AnySchema>;
};

const storeOf = (app: GraviewApp<AnySchema>) =>
  new Store<AnySchema>({ schema: app.schema, mutations: (app.mutations ?? []) as never, snapshot: { nodes: [{ id: "smiths", kind: "household", name: "The Smiths" } as never], edges: [] } });

describe.each([
  ["said with no type", { required: false }],
  ["said as a string", { type: "string", required: false }],
])("an optional record argument %s", (_, to) => {
  const app = compiled(to);
  const addDish = app.mutations!.find((m) => m.name === "add-dish")!;

  it("may be left empty, every other field kept as it is", () => {
    const fields = formFields(addDish.input as never);
    expect(fields.find((f) => f.name === "to")).toMatchObject({ name: "to", optional: true });
    expect(fields.find((f) => f.name === "photo")).toMatchObject({ control: "file", image: true });
  });

  it("left empty, the act applies and makes no link", () => {
    const store = storeOf(app);
    store.apply({ name: "add-dish", args: { name: "Pie" } });
    const pie = store.graph.nodesOfKind("dish" as never)[0] as unknown as { readonly id: string };
    expect(pie).toMatchObject({ name: "Pie" });
    expect(store.graph.out(pie.id, "broughtBy" as never)).toEqual([]);
  });

  it("chosen, it makes the link", () => {
    const store = storeOf(app);
    store.apply({ name: "add-dish", args: { name: "Pie", to: "smiths" } });
    const pie = store.graph.nodesOfKind("dish" as never)[0] as unknown as { readonly id: string };
    expect(store.graph.out(pie.id, "broughtBy" as never).map((n) => n.id)).toEqual(["smiths"]);
  });

  it("sent as \"\", as an agent sends a choice left empty, is no value: the act applies and makes no link", () => {
    const store = storeOf(app);
    store.apply({ name: "add-dish", args: { name: "Pie", to: "" } });
    const pie = store.graph.nodesOfKind("dish" as never)[0] as unknown as { readonly id: string };
    expect(pie).toMatchObject({ name: "Pie" });
    expect(store.graph.out(pie.id, "broughtBy" as never)).toEqual([]);
  });

  it("a preview without it does not fail", () => {
    const preview = storeOf(app).preview({ name: "add-dish", args: { name: "Pie" } });
    expect(preview.diff.addedNodes.map((n) => n.kind)).toEqual(["dish"]);
    expect(preview.diff.addedEdges).toEqual([]);
  });
});

describe("an optional record argument said with no type", () => {
  it("is drawn as a record picker with an empty choice", () => {
    const fields = formFields(compiled({ required: false }).mutations!.find((m) => m.name === "add-dish")!.input as never);
    expect(fields.find((f) => f.name === "to")).toEqual({ control: "node", name: "to", optional: true, kinds: ["household"] });
  });

  it("asks the question its description says, to a form and an agent alike", () => {
    const input = compiled({ required: false, description: "who is bringing it" }).mutations!.find((m) => m.name === "add-dish")!.input;
    expect(JSON.stringify(toJSONSchema(input as never, { unrepresentable: "any" }))).toContain("who is bringing it");
  });
});

describe("graview check on an optional record argument", () => {
  it("accepts the declaration and says the argument as a record that may be left out", () => {
    const app = compiled({ required: false });
    expect(checkApp(app).findings.filter((f) => f.severity === "error")).toEqual([]);
    const store = storeOf(app);
    const form = describeActForm(store, { kind: "human", id: "host", roles: [] }, app.mutations!.find((m) => m.name === "add-dish")! as never);
    expect(formLines(form)).toContain("  - Household (to) — record (household)");
  });

  it("asks for a record argument left unsaid as it always did: one must be chosen", () => {
    const app = compiled({});
    const fields = formFields(app.mutations!.find((m) => m.name === "add-dish")!.input as never);
    expect(fields.find((f) => f.name === "to")).toMatchObject({ control: "node", optional: false });
  });

  it("still refuses \"\" for a record argument that must be chosen", () => {
    const store = storeOf(compiled({}));
    expect(() => store.apply({ name: "add-dish", args: { name: "Pie", to: "" } })).toThrow();
    expect(store.graph.nodesOfKind("dish" as never)).toEqual([]);
  });

  it("warns of an argument with no type that no effect reads, which would be a choice of any record of any kind", () => {
    const document = thanksgiving({ required: false });
    (document.acts["add-dish"].args as Record<string, unknown>)["helper"] = { required: false };
    const result = compileDocument(document);
    expect(result.ok).toBe(true);
    expect(result.findings.filter((f) => f.code === "act-arg-unread")).toEqual([
      expect.objectContaining({
        severity: "warning",
        path: "acts.add-dish.args.helper",
        message: '"add-dish" declares "helper" with no type, and no effect links it, so it is asked as a choice of any record of any kind',
      }),
    ]);
    expect(compileDocument(thanksgiving({ required: false })).findings.filter((f) => f.code === "act-arg-unread")).toEqual([]);
  });

  it("refuses an argument of neither shape by naming both", () => {
    const result = compileDocument(thanksgiving({ required: "no" }));
    expect(result.ok).toBe(false);
    expect(result.findings.find((f) => f.path === "acts.add-dish.args.to")).toMatchObject({ code: "arg-shape" });
  });

  it("says what is wrong with a field-shaped argument as a field's", () => {
    const result = compileDocument(thanksgiving({ type: "strng" }));
    expect(result.ok).toBe(false);
    expect(result.findings.find((f) => f.path.startsWith("acts.add-dish.args.to"))).toMatchObject({ code: "shape", path: "acts.add-dish.args.to.type" });
  });
});
