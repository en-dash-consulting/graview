import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { describePlace, type DescribedPart } from "../../src/describe.js";
import { Store, type AnySchema, type GraviewApp, type Principal } from "../../src/index.js";
import { compileBlocks, fieldSpecsOf, resolveBlocks } from "../../src/blocks.js";
import { compileDocument, editDocument, shapesOfSchema, type Finding } from "../../src/document/index.js";

/**
 * FR-99. A FIGURE'S LABEL IS A TEMPLATE, like a headline's text:
 * `{ "figure": "net", "as": "money", "label": "{name}, net" }` says the
 * record's name, from the same template engine, formatters and budget, and
 * `resolveBlocks` and `describePlace` say the same words. A meter's label
 * is one too. Anywhere else a block holds words — a field's label, what an
 * empty list says, a group's heading — braces are not a template, and the
 * check says so at the block's path rather than letting them be drawn raw.
 */
const lifelogics = JSON.parse(readFileSync(new URL("./fixtures/lifelogics.gdd.json", import.meta.url), "utf8"));
const seed = JSON.parse(readFileSync(new URL("./fixtures/lifelogics.seed.json", import.meta.url), "utf8"));
const owner: Principal = { kind: "human", id: "u:owner", roles: ["owner"] };

const NAMED = { figure: "net", as: "money", currency: "USD", label: "{name}, net" };
const METER = { progress: { value: "count(out('includes'))", max: "4" }, label: "{count(out('includes')) | words} of {name}'s offers" };

function withPage(blocks: unknown[]) {
  const doc = structuredClone(lifelogics);
  doc.views.package.page = blocks;
  return doc;
}
function compiled(doc: unknown): { app: GraviewApp; findings: readonly Finding[] } {
  const result = compileDocument(doc, { today: () => "2026-10-05" });
  if (!result.ok) throw new Error(JSON.stringify(result.findings.filter((f) => f.severity === "error")));
  return result;
}
const storeOf = (app: GraviewApp) => new Store<AnySchema>({ schema: app.schema as AnySchema, mutations: app.mutations ?? [], policy: app.policy!, snapshot: seed });

describe("a figure's label says the record it is about", () => {
  it("resolves as a template: the record's name, a formatter, a walk", () => {
    const { app } = compiled(withPage([NAMED, METER]));
    const store = storeOf(app);
    const schema = app.schema as AnySchema;
    const node = store.graph.getNode("pkg-whole")!;
    const [figure, meter] = resolveBlocks(compileBlocks([NAMED, METER]), { node, graph: store.graph as never, schema, kinds: shapesOfSchema(schema), fields: fieldSpecsOf(schema, "package"), today: "2026-10-05" });
    expect(figure).toEqual({ t: "number", text: "$69,300", label: "The whole thing, net" });
    expect(meter).toMatchObject({ t: "progress", label: "four of The whole thing's offers", text: "4 of 4" });
  });

  it("a label with no braces is said as written, as before", () => {
    const { app } = compiled(lifelogics);
    const store = storeOf(app);
    const schema = app.schema as AnySchema;
    const [figure] = resolveBlocks(compileBlocks([{ figure: "net", as: "money", currency: "USD", label: "After the discount" }]), { node: store.graph.getNode("pkg-start")!, graph: store.graph as never, schema, kinds: shapesOfSchema(schema), fields: {}, today: "2026-10-05" });
    expect(figure).toEqual({ t: "number", text: "$21,000", label: "After the discount" });
  });

  it("describePlace says the label the face draws", () => {
    const { app } = compiled(withPage([NAMED]));
    const result = describePlace(storeOf(app), owner, "pkg-whole", { app, today: "2026-10-05" });
    if (!result.ok) throw new Error(result.error);
    const figures: DescribedPart[] = [];
    const walk = (parts: readonly DescribedPart[]) => parts.forEach((part) => (part.t === "figure" ? figures.push(part) : part.t === "list" ? part.groups.forEach((g) => g.items.forEach((i) => walk(i.parts))) : undefined));
    walk(result.description.parts);
    expect(figures).toContainEqual({ t: "figure", text: "$69,300", label: "The whole thing, net" });
    expect(result.description.problems).toEqual([]);
  });

  it("a label that names what the kind has not is refused at its path, as a headline's would be", () => {
    const result = compileDocument(withPage([{ ...NAMED, label: "{nom}, net" }]));
    expect(result.findings.filter((f) => f.severity === "error").map((f) => [f.code, f.path])).toEqual([["view-name", "views.package.page.0.label"]]);
  });

  it("renaming a field rewrites the label where it names it", () => {
    const result = editDocument(withPage([NAMED, METER]), [{ op: "rename-field", kind: "package", field: "name", to: "title" }]);
    if (!result.ok) throw new Error(JSON.stringify(result.findings));
    const page = (result.document.views as Record<string, { page: Record<string, unknown>[] }>)["package"]!.page;
    expect(page.map((block) => block["label"])).toEqual(["{title}, net", "{count(out('includes')) | words} of {title}'s offers"]);
  });
});

describe("braces in words that are no template are said, never drawn raw unannounced", () => {
  const braced = (blocks: unknown[]) => compiled(withPage(blocks)).findings.filter((f) => f.code === "view-braces");

  it("names a field's label, what an empty list says and a group's heading, each at its block's path", () => {
    const found = braced([
      { field: "net", label: "Net {after}" },
      { list: "out('includes')", empty: "None in {name}", group: { by: "stage", headings: { start: "{start}", later: "Later" } } },
    ]);
    expect(found.map((f) => [f.severity, f.path])).toEqual([
      ["warning", "views.package.page.0.label"],
      ["warning", "views.package.page.1.group.headings.start"],
      ["warning", "views.package.page.1.empty"],
    ]);
    expect(found[0]!.message).toBe('a field\'s label is words, not a template, so "Net {after}" would be drawn with its braces');
  });

  it("LifeLogics, whose words have no braces, is told nothing", () => {
    expect(compiled(lifelogics).findings.filter((f) => f.code === "view-braces")).toEqual([]);
  });
});
