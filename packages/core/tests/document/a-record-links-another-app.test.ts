import { describe, expect, it } from "vitest";
import { compileDocument } from "../../src/check.js";
import { blockContextFor, compileBlocks, fieldSpecOf, resolveBlocks } from "../../src/blocks.js";
import { documentTypes } from "../../src/cli/types.js";
import { DocumentSpec, editDocument, FIELD_TYPES, planMigration, toDocument, type GraviewDocument } from "../../src/document/index.js";
import { formFields } from "../../src/forms.js";
import { appLinkField, createSchema, defineApp, defineNode, isAppAddress, isAppLinkField, refusalOf, Store, z, type AnySchema, type GraviewApp } from "../../src/index.js";
import { mutationToolSchema } from "../../src/json-schema.js";
import { coerceCell } from "../../src/import/coerce.js";
import { readableFields } from "../../src/words.js";

/**
 * FR-171. A RECORD CAN LINK ANOTHER APP.
 *
 *   "house": { "type": "app-link" }
 *
 * The value is the other app's ADDRESS — `@owner/app`, the id its host
 * knows it by, or its absolute https:// address — kept as any value is.
 * What the app is called, and whether this viewer may open it, is the
 * host's `resolveApp` to say; every surface that draws the field asks it.
 * A relation to another app's kind is left for 0.2.
 */
const scenarios = (): GraviewDocument =>
  ({
    format: "graview-document",
    formatVersion: 1,
    name: "Purchase scenarios",
    kinds: {
      scenario: {
        fields: {
          name: { type: "string", required: true },
          house: { type: "app-link", description: "the house this scenario buys" },
        },
      },
    },
    acts: { "add-scenario": { title: "Add a scenario", creates: "scenario" } },
    views: { scenario: { card: [{ title: "{name}" }, { field: "house" }] } },
  }) as unknown as GraviewDocument;

function compiled(doc: unknown = scenarios()): GraviewApp<AnySchema> {
  const result = compileDocument(doc, { today: () => "2026-10-12" });
  if (!result.ok) throw new Error(`the document compiles: ${JSON.stringify(result.findings.filter((f) => f.severity === "error"))}`);
  return result.app as GraviewApp<AnySchema>;
}
const storeOf = (app: GraviewApp<AnySchema>) =>
  new Store<AnySchema>({ schema: app.schema, mutations: app.mutations ?? [], snapshot: { nodes: [{ id: "first", kind: "scenario", name: "Buy it outright" }], edges: [] } as never });
const refusal = (run: () => unknown) => {
  try {
    run();
  } catch (error) {
    return refusalOf(error);
  }
  throw new Error("expected a refusal");
};

describe("an app's address", () => {
  it("is @owner/app, an id, or an absolute http(s) address — never a script, a space or another scheme", () => {
    for (const address of ["@nick/house", "nick/house", "app_kf5eydr9z58jzf", "https://graview.cloud/a/house", "http://localhost:5800/house"]) expect(isAppAddress(address), address).toBe(true);
    for (const address of ["", "javascript:alert(1)", "data:text/html,x", "two words", "/house", "@/house", "ftp://x", "https://x y", "<b>", "x".repeat(501), 42]) expect(isAppAddress(address), String(address)).toBe(false);
  });
});

describe("a document's app-link field", () => {
  it("is a field type of the document, its schema and its check", () => {
    expect(FIELD_TYPES).toContain("app-link");
    expect(DocumentSpec.safeParse(scenarios()).success).toBe(true);
    expect(compileDocument(scenarios()).findings.filter((f) => f.severity === "error")).toEqual([]);
    const wrong = scenarios() as unknown as { kinds: { scenario: { fields: Record<string, unknown> } } };
    wrong.kinds.scenario.fields["house"] = { type: "app-link", options: ["a"] };
    expect(compileDocument(wrong).findings.filter((f) => f.severity === "error").map((f) => f.path)).toContain("kinds.scenario.fields.house.options");
  });

  it("keeps an address an act sets, refuses what is not one, and undoes like any edit", () => {
    const store = storeOf(compiled());
    const done = store.apply({ name: "edit-scenario", args: { id: "first", house: "@nick/house" } });
    expect(store.graph.getNode("first")).toMatchObject({ house: "@nick/house" });
    for (const house of ["javascript:alert(1)", "the blue house", ""]) expect(refusal(() => store.apply({ name: "edit-scenario", args: { id: "first", house } }))).toMatchObject({ reason: "invalid" });
    store.undo(done.batch!);
    expect(store.graph.getNode("first")?.["house"]).toBeUndefined();
  });

  it("is asked for as an address: the form says so, and an agent's tool says what it takes", () => {
    const edit = storeOf(compiled()).mutation("edit-scenario");
    expect(formFields(edit.input).find((f) => f.name === "house")).toMatchObject({ control: "text", app: true });
    const house = (mutationToolSchema(edit).inputSchema["properties"] as Record<string, Record<string, unknown>>)["house"];
    expect(house).toMatchObject({ type: "string", maxLength: 500, "x-graview-app-link": true, description: "the house this scenario buys" });
    expect(new RegExp(String(house?.["pattern"])).test("@nick/house")).toBe(true);
    expect(new RegExp(String(house?.["pattern"])).test("javascript:alert(1)")).toBe(false);
  });

  it("is added, and a field retyped to one, by editDocument", () => {
    const added = editDocument(scenarios(), [{ op: "add-field", kind: "scenario", field: "lender", spec: { type: "app-link" } }]);
    expect(added.ok).toBe(true);
    if (added.ok) expect(added.document.kinds["scenario"]!.fields["lender"]).toEqual({ type: "app-link" });
    const doc = scenarios() as unknown as { kinds: { scenario: { fields: Record<string, unknown> } } };
    doc.kinds.scenario.fields["link"] = { type: "string" };
    const retyped = editDocument(doc as never, [{ op: "retype-field", kind: "scenario", field: "link", type: "app-link" }]);
    expect(retyped.ok).toBe(true);
    if (retyped.ok) expect(retyped.document.kinds["scenario"]!.fields["link"]).toEqual({ type: "app-link" });
  });

  it("keeps an address through a retype, and clears what is not one", () => {
    const before = scenarios() as unknown as { kinds: { scenario: { fields: Record<string, unknown> } } };
    before.kinds.scenario.fields["house"] = { type: "string" };
    const plan = planMigration(before as never, scenarios(), {
      nodes: [
        { id: "a", kind: "scenario", name: "A", house: "@nick/house" },
        { id: "b", kind: "scenario", name: "B", house: "the blue one" },
      ],
      edges: [],
    });
    expect(plan.counts.cleared).toBe(1);
  });

  it("is read by a record's facts as an app, left out of a glance's words, and named by a card's field block", () => {
    const app = compiled();
    const definition = app.schema.tryDefinition("scenario");
    const node = { id: "first", kind: "scenario", name: "Buy it outright", house: "@nick/house" };
    expect(readableFields(node, definition).find((f) => f.key === "house")).toMatchObject({ app: "@nick/house", value: "@nick/house" });
    expect(readableFields(node, definition, { glance: true }).map((f) => f.key)).toEqual(["name"]);
    const store = new Store<AnySchema>({ schema: app.schema, mutations: app.mutations ?? [], snapshot: { nodes: [node], edges: [] } as never });
    const [, field] = resolveBlocks(compileBlocks([{ title: "{name}" }, { field: "house" }]), blockContextFor(store, null, node));
    expect(field).toMatchObject({ t: "field", field: "house", app: "@nick/house" });
  });

  it("is read from a spreadsheet's cell as an address, and a cell that is none is refused in words", () => {
    expect(coerceCell({ type: "app-link" }, " @nick/house ", "House")).toEqual({ ok: true, value: "@nick/house" });
    expect(coerceCell({ type: "app-link" }, "the blue one", "House")).toEqual({ ok: false, why: "“the blue one” under House is not another app's address" });
  });

  it("is written as TypeScript by graview types: a string, said to be another app's address", () => {
    expect(documentTypes(scenarios())).toMatch(/Another app's address[^\n]*\n\s*readonly house\?: string;/);
  });
});

describe("a TypeScript declaration's app-link field", () => {
  const scenario = defineNode("scenario", { fields: z.object({ name: z.string(), house: appLinkField().optional().describe("the house") }) });

  it("is marked through optional and describe, and written as a document's", () => {
    expect(isAppLinkField(scenario.fields.shape.house)).toBe(true);
    expect(isAppLinkField(z.string())).toBe(false);
    expect(fieldSpecOf(appLinkField())).toEqual({ type: "app-link", required: true });
    const { document, findings } = toDocument(defineApp({ name: "scenarios", schema: createSchema([scenario]) }));
    expect(findings.filter((f) => f.severity === "error")).toEqual([]);
    expect(document.kinds["scenario"]!.fields["house"]).toMatchObject({ type: "app-link" });
  });

  it("refuses a value that is not an app's address", () => {
    expect(appLinkField().safeParse("@nick/house").success).toBe(true);
    expect(appLinkField().safeParse("javascript:alert(1)").success).toBe(false);
  });
});
