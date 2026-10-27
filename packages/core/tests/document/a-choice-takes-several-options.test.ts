import { describe, expect, it } from "vitest";
import { checkApp, compileDocument } from "../../src/check.js";
import { editDocument, type FieldSpec, type GraviewDocument } from "../../src/document/index.js";
import { fieldSpecOf } from "../../src/blocks.js";
import { arrange, arrangeable, kindListFindings } from "../../src/arrange.js";
import { documentListFields } from "../../src/kind-list.js";
import { listCsv } from "../../src/csv.js";
import { formFields } from "../../src/mutations/form.js";
import { coerceCell } from "../../src/import/index.js";
import { nodeJsonSchema, mutationToolSchema } from "../../src/json-schema.js";
import { readableFields, valueWords } from "../../src/words.js";
import { withComputed } from "../../src/document/computed-values.js";
import { fieldType } from "../../src/cli/types.js";
import { coerce } from "../../src/document/migrate.js";
import { labelOf, Store, type AnySchema, type GraviewApp } from "../../src/index.js";

/**
 * A CHOICE TAKES SEVERAL OPTIONS (Roadmap f-multi-select-enum, FR-233). An
 * enum took one option and a list took free words, so a memo's recipients —
 * the CTO, the developers, QA, product — had nowhere to be several fixed
 * options. `"type": "enum", "multiple": true` keeps the field's options and
 * their labels on the one shape an enum has: a record holds a list of
 * options, every face says each by its label, a list filters by one of
 * them, a sheet's cell lists them, and the derived acts ask for a list.
 */
const memos = (): GraviewDocument =>
  ({
    format: "graview-document",
    formatVersion: 1,
    name: "Memos",
    kinds: {
      memo: {
        fields: {
          title: { type: "string", required: true },
          recipients: { type: "enum", multiple: true, options: ["cto", "developers", "qa", "product"], optionLabels: { cto: "CTO", qa: "QA" } },
          status: { type: "enum", options: ["draft", "sent"], default: "draft" },
        },
      },
    },
    acts: { "add-memo": { title: "Add a memo", creates: "memo" } },
  }) as unknown as GraviewDocument;

function open(document: GraviewDocument) {
  const compiled = compileDocument(document, { today: () => "2026-10-27" });
  if (!compiled.ok) throw new Error(JSON.stringify(compiled.findings));
  const app = compiled.app as GraviewApp<AnySchema>;
  const store = new Store<AnySchema>({ schema: app.schema, mutations: (app.mutations ?? []) as never, snapshot: { nodes: [], edges: [] } as never });
  store.apply({ name: "add-memo", args: { id: "memo:q4", title: "Q4 plan", recipients: ["cto", "qa"] } });
  store.apply({ name: "add-memo", args: { id: "memo:oncall", title: "On-call rota", recipients: ["developers"] } });
  store.apply({ name: "add-memo", args: { id: "memo:blank", title: "Untitled" } });
  return { app, store };
}

describe("an enum that takes several options", () => {
  it("compiles to a list of its options, refuses an option it does not offer, and reads back as the same field", () => {
    const { store } = open(memos());
    const shape = (store.schema.tryDefinition("memo")?.fields as { shape: Record<string, unknown> }).shape;
    expect(fieldSpecOf(shape["recipients"])).toEqual({ type: "enum", multiple: true, options: ["cto", "developers", "qa", "product"] });
    expect(fieldSpecOf(shape["status"])).toEqual({ type: "enum", options: ["draft", "sent"] });
    expect(() => store.apply({ name: "add-memo", args: { id: "memo:bad", title: "Bad", recipients: ["cto", "board"] } })).toThrow(/board|option|recipients/i);
    expect(() => store.apply({ name: "add-memo", args: { id: "memo:bad", title: "Bad", recipients: "cto" } })).toThrow();
  });

  it("is refused on a field that is not an enum, and its default must be among its options", () => {
    const onAString = memos();
    (onAString.kinds["memo"]!.fields as Record<string, unknown>)["title"] = { type: "string", multiple: true };
    const refused = compileDocument(onAString, { today: () => "2026-10-27" });
    expect(refused.ok).toBe(false);
    expect(refused.findings.map((finding) => finding.path)).toContain("kinds.memo.fields.title.multiple");
    const badDefault = memos();
    (badDefault.kinds["memo"]!.fields as Record<string, unknown>)["recipients"] = { type: "enum", multiple: true, options: ["cto", "qa"], default: ["cto", "board"] };
    const findings = compileDocument(badDefault, { today: () => "2026-10-27" }).findings;
    expect(findings.some((finding) => finding.code === "default-option" && finding.path === "kinds.memo.fields.recipients.default")).toBe(true);
    const goodDefault = memos();
    (goodDefault.kinds["memo"]!.fields as Record<string, unknown>)["recipients"] = { type: "enum", multiple: true, options: ["cto", "qa"], default: ["cto"] };
    expect(compileDocument(goodDefault, { today: () => "2026-10-27" }).findings.filter((finding) => finding.code === "default-option")).toEqual([]);
    // The checker says nothing of a well-formed one.
    const { app } = open(memos());
    expect(checkApp(app).findings.filter((finding) => finding.severity === "error")).toEqual([]);
  });

  it("is said by each option's label on a record's facts, in words and in a sheet", () => {
    const { store } = open(memos());
    const definition = store.schema.tryDefinition("memo");
    const facts = readableFields(store.graph.getNode("memo:q4") as never, definition);
    expect(facts.find((fact) => fact.key === "recipients")?.value).toBe("CTO, QA");
    expect(valueWords(definition, "recipients", "qa")).toBe("QA");
    expect(valueWords(definition, "recipients", ["developers", "qa"])).toBe("Developers, QA");
    const csv = listCsv({ kind: "memo", schema: store.schema, graph: store.graph, groups: [{ nodes: store.graph.nodesOfKind("memo" as never) as never }], grouped: false, words: { labelOf, readableFields, withComputed } });
    expect(csv).toContain("CTO, QA");
    expect(csv.split("\n")[0]).toContain("Recipients");
  });

  it("filters a list by one of its options, and is neither sorted nor grouped by", () => {
    const { store } = open(memos());
    const offers = arrangeable(store.schema, "memo");
    const filter = offers.filters.find((offer) => offer.key === "recipients");
    expect(filter).toMatchObject({ about: "field", type: "choice", options: ["cto", "developers", "qa", "product"] });
    expect(offers.sorts.some((offer) => offer.key === "recipients")).toBe(false);
    expect(offers.groups.some((offer) => offer.key === "recipients")).toBe(false);
    const ctx = { schema: store.schema, graph: store.graph } as never;
    const nodes = store.graph.nodesOfKind("memo" as never) as never;
    expect(arrange(nodes, { filter: [{ key: "recipients", value: "qa" }] } as never, ctx).nodes.map((node: { id: string }) => node.id)).toEqual(["memo:q4"]);
    expect(arrange(nodes, { filter: [{ key: "recipients", value: "developers" }] } as never, ctx).nodes.map((node: { id: string }) => node.id)).toEqual(["memo:oncall"]);
    const document = memos();
    const findings = kindListFindings("memo", { group: "recipients" }, documentListFields(document.kinds["memo"]));
    expect(findings.map((finding) => finding.message).join(" ")).toMatch(/grouped by/);
  });

  it("is asked for as several of a choice by a form and a tool, and a sheet's cell lists them", () => {
    const { store } = open(memos());
    const add = store.allMutations().find((one) => one.name === "add-memo")!;
    const field = formFields(add.input).find((one) => one.name === "recipients");
    expect(field).toMatchObject({ control: "choice", multiple: true, options: ["cto", "developers", "qa", "product"] });
    const tool = mutationToolSchema(add as never);
    const recipients = (tool.inputSchema as { properties: Record<string, Record<string, unknown>> }).properties["recipients"];
    expect(recipients).toMatchObject({ type: "array", items: { type: "string", enum: ["cto", "developers", "qa", "product"] } });
    const record = nodeJsonSchema(store.schema.tryDefinition("memo")!);
    expect((record["properties"] as Record<string, Record<string, unknown>>)["recipients"]).toMatchObject({ type: "array", items: { enum: ["cto", "developers", "qa", "product"] } });
    const spec: FieldSpec = { type: "enum", multiple: true, options: ["cto", "developers", "qa", "product"] };
    expect(coerceCell(spec, "CTO; QA", "Recipients", { optionWords: (option) => valueWords(store.schema.tryDefinition("memo"), "recipients", option) })).toEqual({ ok: true, value: ["cto", "qa"] });
    expect(coerceCell(spec, "developers, product", "Recipients")).toEqual({ ok: true, value: ["developers", "product"] });
    expect(coerceCell(spec, "board", "Recipients")).toMatchObject({ ok: false });
    expect(fieldType(spec)).toBe('("cto" | "developers" | "qa" | "product")[]');
  });

  it("keeps the options that fit when a field changes between one and several, by edit and by migration", () => {
    const several: FieldSpec = { type: "enum", multiple: true, options: ["cto", "qa"] };
    const one: FieldSpec = { type: "enum", options: ["cto", "qa"] };
    expect(coerce("cto", "enum", several)).toEqual(["cto"]);
    expect(coerce(["cto", "board"], "enum", several)).toEqual(["cto"]);
    expect(coerce(["qa", "cto"], "enum", one)).toBe("qa");
    expect(coerce("cto, qa", "string", several)).toEqual(["cto", "qa"]);
    const edited = editDocument(memos(), [{ op: "retype-field", kind: "memo", field: "status", type: "enum", multiple: true }]);
    if (!edited.ok) throw new Error(JSON.stringify(edited.findings));
    const status = (edited.document as unknown as { kinds: { memo: { fields: { status: Record<string, unknown> } } } }).kinds.memo.fields.status;
    expect(status).toMatchObject({ type: "enum", multiple: true, options: ["draft", "sent"], default: ["draft"] });
    expect(edited.said.join(" ")).toMatch(/several/);
    const back = editDocument(edited.document, [{ op: "retype-field", kind: "memo", field: "status", type: "enum" }]);
    if (!back.ok) throw new Error(JSON.stringify(back.findings));
    expect((back.document as unknown as { kinds: { memo: { fields: { status: Record<string, unknown> } } } }).kinds.memo.fields.status).toEqual({ type: "enum", options: ["draft", "sent"], default: "draft" });
  });
});
