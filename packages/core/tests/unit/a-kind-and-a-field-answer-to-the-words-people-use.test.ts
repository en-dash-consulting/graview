import { describe, expect, it } from "vitest";
import { z } from "zod";
import { checkApp } from "../../src/cli/check.js";
import { describeApp } from "../../src/cli/describe.js";
import { compileDocument } from "../../src/check.js";
import { editDocument, toDocument, type GraviewDocument } from "../../src/document/index.js";
import { aiContextOf } from "../../src/catalog.js";
import { frictionDigest, frictionEvent } from "../../src/friction.js";
import { search } from "../../src/search.js";
import { createSchema, defineApp, defineNode, Store, type AnySchema, type GraviewApp } from "../../src/index.js";

/**
 * A KIND AND A FIELD ANSWER TO THE WORDS PEOPLE USE (Roadmap
 * f-learned-suggestions). "Supplier" finds the vendors once the app says
 * it is another word for one: `aliases` on a kind and on a field, in a
 * document and in `defineNode` alike, read by search, said to a model and
 * by `graview describe`, changed by `add-alias` and `set-aliases`, and held
 * by the checker to words nothing else in the app is called.
 */

const doc = (aliases: { kind?: readonly string[]; field?: readonly string[] } = {}): GraviewDocument =>
  ({
    format: "graview-document",
    formatVersion: 1,
    name: "Wedding",
    kinds: {
      vendor: {
        noun: "vendor",
        plural: "vendors",
        ...(aliases.kind ? { aliases: aliases.kind } : {}),
        fields: { name: { type: "string", required: true }, price: { type: "number", ...(aliases.field ? { aliases: aliases.field } : {}) } },
      },
      guest: { fields: { name: { type: "string", required: true } } },
    },
  }) as unknown as GraviewDocument;

const compiled = (document: GraviewDocument): GraviewApp => {
  const result = compileDocument(document);
  if (!result.ok) throw new Error(JSON.stringify(result.findings, null, 2));
  return result.app as GraviewApp;
};

describe("aliases in the declaration", () => {
  it("a document's kind and field aliases reach the definition and come back as the document", () => {
    const app = compiled(doc({ kind: ["supplier"], field: ["cost", "fee"] }));
    const definition = app.schema.tryDefinition("vendor") as { aliases?: readonly string[]; fieldAliases?: Record<string, readonly string[]> };
    expect(definition.aliases).toEqual(["supplier"]);
    expect(definition.fieldAliases).toEqual({ price: ["cost", "fee"] });
    const back = toDocument(app).document;
    expect(back.kinds["vendor"]!.aliases).toEqual(["supplier"]);
    expect(back.kinds["vendor"]!.fields["price"]!.aliases).toEqual(["cost", "fee"]);
  });

  it("defineNode takes the same, and the checker holds it as it holds a document's", () => {
    const vendor = defineNode("vendor", { fields: z.object({ name: z.string(), price: z.number().optional() }), aliases: ["supplier", "guest"], fieldAliases: { price: ["cost"], nothing: ["x"] } });
    const guest = defineNode("guest", { fields: z.object({ name: z.string() }) });
    const app = defineApp({ name: "w", schema: createSchema([vendor, guest]) });
    const findings = checkApp(app, { design: false }).findings.filter((one) => one.code === "alias-taken" || one.code === "alias-field");
    expect(findings.map((one) => one.code).sort()).toEqual(["alias-field", "alias-taken"]);
    expect(findings.find((one) => one.code === "alias-taken")!.message).toMatch(/guest/);
  });

  it("a document refuses an alias another kind is called, or one said twice", () => {
    const taken = compileDocument(doc({ kind: ["guests"] }));
    expect(taken.ok).toBe(false);
    expect(!taken.ok && taken.findings.map((one) => one.code)).toContain("alias-taken");
    const field = compileDocument({ ...doc(), kinds: { ...doc().kinds, vendor: { ...doc().kinds["vendor"]!, fields: { name: { type: "string", required: true }, price: { type: "number", aliases: ["name"] } } } } } as GraviewDocument);
    expect(!field.ok && field.findings.map((one) => one.code)).toContain("alias-taken");
  });
});

describe("the edits", () => {
  it("add-alias adds one word to a kind or a field and says so; set-aliases replaces them, null clears them", () => {
    const added = editDocument(doc(), [{ op: "add-alias", kind: "vendor", alias: "Supplier" }, { op: "add-alias", kind: "vendor", field: "price", alias: "cost" }]);
    if (!added.ok) throw new Error(JSON.stringify(added.findings));
    expect(added.document.kinds["vendor"]!.aliases).toEqual(["supplier"]);
    expect(added.document.kinds["vendor"]!.fields["price"]!.aliases).toEqual(["cost"]);
    expect(added.said.join(" ")).toMatch(/“supplier”|"supplier"/);
    const again = editDocument(added.document, [{ op: "add-alias", kind: "vendor", alias: "supplier" }]);
    expect(again.ok && again.document.kinds["vendor"]!.aliases).toEqual(["supplier"]);
    const set = editDocument(added.document, [{ op: "set-aliases", kind: "vendor", aliases: ["caterer", "florist"] }]);
    expect(set.ok && set.document.kinds["vendor"]!.aliases).toEqual(["caterer", "florist"]);
    const cleared = editDocument(added.document, [{ op: "set-aliases", kind: "vendor", field: "price", aliases: null }]);
    expect(cleared.ok && cleared.document.kinds["vendor"]!.fields["price"]!.aliases).toBeUndefined();
  });

  it("refuses an alias another kind is already called, with a sentence", () => {
    const refused = editDocument(doc(), [{ op: "add-alias", kind: "vendor", alias: "guest" }]);
    expect(refused.ok).toBe(false);
    expect(!refused.ok && refused.findings[0]!.message).toMatch(/guest/);
  });
});

describe("what reads them", () => {
  const app = compiled(doc({ kind: ["supplier"], field: ["cost"] }));
  const store = new Store<AnySchema>({ schema: app.schema, mutations: app.mutations ?? [], snapshot: { nodes: [{ id: "v1", kind: "vendor", name: "Bloom" }] as never, edges: [] } });

  it("search finds the kind by its alias", () => {
    const hits = search(store, "supplier").hits;
    expect(hits[0]).toMatchObject({ about: "kind", kind: "vendor", why: { field: "alias" } });
  });

  it("a model is told them with the kind, and describe says them", () => {
    const context = aiContextOf(store, { on: "place", place: "home" }, { principal: { kind: "human" } });
    expect(context.schema.kinds.find((one) => one.kind === "vendor")).toMatchObject({ aliases: ["supplier"], fieldAliases: { price: ["cost"] } });
    expect(describeApp(app)).toMatch(/supplier/);
    expect(describeApp(app)).toMatch(/cost/);
  });

  it("a word the app now answers to is no longer an unknown word to the friction digest", () => {
    const events = ["ada", "bo"].map((id) => frictionEvent({ type: "search-miss", words: "supplier" }, { kind: "human", id })!);
    expect(frictionDigest(events, compiled(doc()).schema).unknownWords).toHaveLength(1);
    expect(frictionDigest(events, app.schema).unknownWords).toEqual([]);
  });
});
