import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { checkApp } from "../../src/cli/check.js";
import { describePlace, type DescribedPart } from "../../src/describe.js";
import { createSchema, defineApp, defineNode, Store, z, type AnySchema, type AnyGraphNode, type GraviewApp, type Principal } from "../../src/index.js";
import { compileBlocks, fieldSpecsOf, resolveBlocks, type ResolvedBlock } from "../../src/blocks.js";
import { diffDocuments, editDocument, formatMoney, shapesOfSchema, toDocument } from "../../src/document/index.js";
import { compileDocument } from "../../src/check.js";

/**
 * FR-100. CURRENCY ON ANY MONEY. A figure and a field shown as money take a
 * `currency`; the app's own — `brand.currency`, with `brand.locale` for how
 * it is written — applies wherever a block names none: a figure, a field and
 * a template's `{x | money}`. So one card's figure and field show the same
 * symbol, and `describePlace` says what the faces draw. Formatting is
 * `Intl.NumberFormat` in the app's locale, "en-US" when it names none; an
 * app with no currency says sums as numbers, as before.
 */
const lifelogics = JSON.parse(readFileSync(new URL("./fixtures/lifelogics.gdd.json", import.meta.url), "utf8"));
const seed = JSON.parse(readFileSync(new URL("./fixtures/lifelogics.seed.json", import.meta.url), "utf8"));
const owner: Principal = { kind: "human", id: "u:owner", roles: ["owner"] };

function compiled(doc: unknown = lifelogics): GraviewApp {
  const result = compileDocument(doc, { today: () => "2026-10-05" });
  if (!result.ok) throw new Error(JSON.stringify(result.findings.filter((f) => f.severity === "error")));
  return result.app;
}
const withBrand = (brand: unknown) => ({ ...structuredClone(lifelogics), brand });

/** A card's blocks worked out for one record, with the app's money as the faces hand it over. */
function card(app: GraviewApp, kind: string, id: string, slot: "card" | "row" = "card"): readonly ResolvedBlock[] {
  const store = new Store<AnySchema>({ schema: app.schema as AnySchema, mutations: app.mutations ?? [], policy: app.policy!, snapshot: seed });
  const schema = app.schema as AnySchema;
  const spec = (app.viewSpecs as Record<string, Record<string, unknown[]>>)[kind]![slot]!;
  return resolveBlocks(compileBlocks(spec), {
    node: store.graph.getNode(id) as AnyGraphNode,
    graph: store.graph as never,
    schema,
    kinds: shapesOfSchema(schema),
    fields: fieldSpecsOf(schema, kind),
    definition: schema.tryDefinition(kind) as never,
    today: "2026-10-05",
    ...(app.brand ? { money: app.brand } : {}),
  });
}
const texts = (blocks: readonly ResolvedBlock[]) => blocks.map((block) => ("text" in block ? block.text : undefined)).filter(Boolean);

describe("the app's currency is said wherever a block names none", () => {
  it("LifeLogics declares it once, brand.currency, and its card's field and figure show the same symbol", () => {
    const app = compiled();
    expect(app.brand?.currency).toBe("USD");
    // The package's card: a field shown as money, which names no currency.
    expect(card(app, "package", "pkg-start")).toContainEqual({ t: "field", field: "net", label: "After the discount", text: "$21,000" });
    // The offer's card: a figure naming USD, and {list | money} and {net | money} in a template, naming none.
    const offer = texts(card(app, "offer", "offer-workshop"));
    expect(offer).toContain("$8,400");
    expect(offer).toContain("$12,000 at list, less 30%. $8,400 over one unit.");
  });

  it("a figure that names no currency takes the app's: a package's row", () => {
    expect(card(compiled(), "package", "pkg-start", "row")).toContainEqual({ t: "number", text: "$21,000", label: "After the discount" });
  });

  it("in another currency and locale, the figure, the field and the template agree, and a block's own currency wins", () => {
    const app = compiled(withBrand({ currency: "EUR", locale: "de-DE" }));
    const pkg = card(app, "package", "pkg-start");
    expect(pkg).toContainEqual({ t: "field", field: "net", label: "After the discount", text: formatMoney(21_000, { currency: "EUR", locale: "de-DE" }) });
    expect(formatMoney(21_000, { currency: "EUR", locale: "de-DE" })).toMatch(/^21\.000\s€$/);
    const offer = texts(card(app, "offer", "offer-workshop"));
    // The offer's figure names USD, so it keeps its dollars, written for the app's locale.
    expect(offer).toContain(formatMoney(8_400, { currency: "USD", locale: "de-DE" }));
    expect(offer).toContain(`${formatMoney(12_000, { currency: "EUR", locale: "de-DE" })} at list, less 30%. ${formatMoney(8_400, { currency: "EUR", locale: "de-DE" })} over one unit.`);
  });

  it("a field may name its own currency", () => {
    const doc = withBrand({ currency: "USD" });
    doc.views.package.card[2] = { field: "net", as: "money", currency: "GBP" };
    expect(card(compiled(doc), "package", "pkg-start")).toContainEqual({ t: "field", field: "net", label: "After the discount", text: "£21,000" });
  });

  it("an app with no currency says sums as numbers, as before", () => {
    const doc = structuredClone(lifelogics);
    delete doc.brand;
    expect(card(compiled(doc), "package", "pkg-start")).toContainEqual({ t: "field", field: "net", label: "After the discount", text: "21,000" });
  });

  it("describePlace says the money the faces draw", () => {
    const app = compiled(withBrand({ currency: "EUR", locale: "de-DE" }));
    const store = new Store<AnySchema>({ schema: app.schema as AnySchema, mutations: app.mutations ?? [], policy: app.policy!, snapshot: seed });
    const result = describePlace(store, owner, "the-packages", { app, today: "2026-10-05" });
    if (!result.ok) throw new Error(result.error);
    const figures: string[] = [];
    const walk = (parts: readonly DescribedPart[]) => parts.forEach((part) => (part.t === "figure" ? figures.push(part.text) : part.t === "list" ? part.groups.forEach((g) => g.items.forEach((i) => walk(i.parts))) : undefined));
    walk(result.description.parts);
    expect(figures).toContain(formatMoney(21_000, { currency: "EUR", locale: "de-DE" }));
  });
});

describe("the currency is declared, checked and edited in one place", () => {
  it("a document's brand may carry the money alone, without an accent", () => {
    const app = compiled(withBrand({ currency: "EUR" }));
    expect(app.brand).toMatchObject({ currency: "EUR", name: "A proposal" });
  });

  it("a currency that is not a three-letter code is refused at its path, on the brand and on a block", () => {
    const bad = compileDocument(withBrand({ currency: "dollars" }));
    expect(bad.findings.some((f) => f.severity === "error" && f.path.startsWith("brand.currency"))).toBe(true);
    const doc = structuredClone(lifelogics);
    doc.views.package.card[2] = { field: "net", currency: "GBP" };
    expect(compileDocument(doc).findings.filter((f) => f.code === "view-currency").map((f) => [f.path, f.message])).toEqual([["views.package.card.2.currency", "a currency belongs on a field shown as money"]]);
  });

  it("a declared app's brand.currency is checked: brand-currency and brand-locale name what cannot be said", () => {
    const thing = defineNode("thing", { fields: z.object({ name: z.string() }) });
    const app = defineApp({ name: "Things", schema: createSchema([thing]), brand: { name: "Things", schemes: compiled(withBrand({ accent: "#2f6f4e" })).brand!.schemes, currency: "usd", locale: "not a locale" } });
    const codes = checkApp(app).findings.filter((f) => f.code.startsWith("brand-")).map((f) => f.code);
    expect(codes).toEqual(["brand-currency", "brand-locale"]);
  });

  it("set-brand sets the money apart from the colors, says so, and a diff says it in words", () => {
    const doc = structuredClone(lifelogics);
    const colored = editDocument(doc, [{ op: "set-brand", accent: "#2f6f4e" }]);
    if (!colored.ok) throw new Error(JSON.stringify(colored.findings));
    expect(colored.document.brand).toEqual({ currency: "USD", accent: "#2f6f4e" });
    const euros = editDocument(colored.document, [{ op: "set-brand", currency: "EUR", locale: "de-DE" }]);
    if (!euros.ok) throw new Error(JSON.stringify(euros.findings));
    expect(euros.said).toEqual(["Money is said in EUR.", "Money is written for de-DE."]);
    expect(euros.document.brand).toEqual({ currency: "EUR", locale: "de-DE", accent: "#2f6f4e" });
    expect(diffDocuments(colored.document, euros.document).sentences).toEqual(["Money is said in EUR, written for de-DE."]);
    const plain = editDocument(euros.document, [{ op: "set-brand", accent: null, currency: null, locale: null }]);
    if (!plain.ok) throw new Error(JSON.stringify(plain.findings));
    expect(plain.document.brand).toBeUndefined();
    expect(editDocument(doc, [{ op: "set-brand", currency: "dollars" }]).ok).toBe(false);
  });

  it("a rename keeps a block's currency", () => {
    const doc = structuredClone(lifelogics);
    const result = editDocument(doc, [{ op: "rename-field", kind: "offer", field: "list", to: "price" }]);
    if (!result.ok) throw new Error(JSON.stringify(result.findings));
    const offerCard = (result.document.views as Record<string, { card: Record<string, unknown>[] }>)["offer"]!.card;
    expect(offerCard.find((block) => block["figure"] === "netEach")).toMatchObject({ as: "money", currency: "USD" });
    expect(result.document.brand).toEqual({ currency: "USD" });
  });

  it("a declared app's money goes across to its document", () => {
    const thing = defineNode("thing", { fields: z.object({ name: z.string() }) });
    const app = defineApp({ name: "Things", schema: createSchema([thing]), brand: { name: "Things", schemes: compiled(withBrand({ accent: "#2f6f4e" })).brand!.schemes, currency: "EUR" } });
    expect(toDocument(app).document.brand).toEqual({ currency: "EUR" });
  });
});
