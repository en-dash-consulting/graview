import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { compileDocument } from "../../src/check.js";
import { Store, type AnySchema, type GraviewApp, type Principal } from "../../src/index.js";
import { amountBox, amountInBox, readableFields, readAmount } from "../../src/words.js";
import { formFields } from "../../src/forms.js";
import { diffDocuments, editDocument } from "../../src/document/index.js";
import { describeApp } from "../../src/cli/describe.js";
import { mutationToolSchema } from "../../src/json-schema.js";

/**
 * A FIELD MARKED `"format": "money"` IS SAID AS MONEY ON EVERY DEFAULT FACE.
 *
 * Found on a Graview Cloud app (Oct 13): a deal's `amount`, a number marked
 * money in an app whose currency is USD, read "10000" on the record page,
 * the list, the table and the form; only a `{amount | money}` template and
 * a lens block said "$10,000". The kind's `display.format` now says every
 * formatted number — money in the app's currency (or the field's own, a
 * unit like "EUR"), a fraction as a percent, a duration in hours and
 * minutes, a measure with its unit — so every face that reads a record
 * (`readableFields`: the record's facts, a glance, a card, a table's cell,
 * a static page) says the same. A form asks for the amount as it is said.
 */
const deals = JSON.parse(readFileSync(new URL("./fixtures/money.gdd.json", import.meta.url), "utf8"));
const owner: Principal = { kind: "human", id: "u:owner", roles: ["owner"] };

function compiled(doc: unknown = deals): GraviewApp {
  const result = compileDocument(doc, { today: () => "2026-10-13" });
  if (!result.ok) throw new Error(JSON.stringify(result.findings.filter((f) => f.severity === "error")));
  return result.app;
}
const deal = { id: "d1", kind: "deal", name: "Acme rebrand", amount: 10000, margin: 0.125, effort: 90, weight: 12.5, fee: 1250.5, stage: "won" };

describe("a number said as its field declares it", () => {
  it("says money in the app's currency, a fraction as a percent, a duration in hours and minutes, a measure with its unit", () => {
    const app = compiled();
    const fields = readableFields(deal, app.schema.tryDefinition("deal"));
    const said = Object.fromEntries(fields.map((field) => [field.key, field.value]));
    expect(said).toMatchObject({ amount: "$10,000", margin: "13%", effort: "1 h 30 min", weight: "12.5 kg", fee: "€1,250.50" });
    // A glance says the value with its label, as a number always was: "Amount $10,000".
    expect(fields.find((field) => field.key === "amount")?.alone).toBe("Amount $10,000");
    // The edit control still holds the value as the record keeps it.
    expect(fields.find((field) => field.key === "amount")?.stored).toBe("10000");
  });

  it("says it in the app's locale", () => {
    const app = compiled({ ...structuredClone(deals), brand: { currency: "EUR", locale: "de-DE" } });
    const said = Object.fromEntries(readableFields(deal, app.schema.tryDefinition("deal")).map((field) => [field.key, field.value]));
    expect(said["amount"]).toMatch(/^10\.000\s€$/);
  });

  it("without a currency, says money as a number in figures", () => {
    const { brand: _, ...plain } = structuredClone(deals);
    const app = compiled(plain);
    const said = Object.fromEntries(readableFields(deal, app.schema.tryDefinition("deal")).map((field) => [field.key, field.value]));
    expect(said["amount"]).toBe("10,000");
  });

  it("a bare {amount} in a label or a description says it as money", () => {
    const app = compiled();
    expect(app.schema.tryDefinition("deal")?.describe?.(deal as never)).toBe("Acme rebrand for $10,000");
  });

  it("the line a creating act keeps, and a change's, say the amount as money", async () => {
    const app = compiled();
    const store = new Store<AnySchema>({ schema: app.schema as AnySchema, mutations: app.mutations ?? [], policy: app.policy!, snapshot: { nodes: [deal as never], edges: [] } });
    const made = store.apply({ name: "add-deal", args: { name: "Studio fit-out", amount: 10000 } }, { author: owner });
    expect(made.intent).toBe("Add a deal: Studio fit-out ($10,000)");
    const changed = store.apply({ name: "set-amount", args: { id: "d1", amount: 12500 } }, { author: owner });
    expect(changed.intent).not.toMatch(/12500/);
  });
});

describe("an edit says a field's format in words, and a format alone can change", () => {
  it("add-field with a format says it, and refuses one on a field that holds no number", () => {
    const added = editDocument(deals, [{ op: "add-field", kind: "deal", field: "deposit", type: "number", format: "money" }]);
    expect(added.ok && added.said).toEqual(["deal gains a field, deposit (number, money in USD — 10000 reads $10,000)."]);
    const refused = editDocument(deals, [{ op: "add-field", kind: "deal", field: "notes", type: "string", format: "money" }]);
    expect(refused.ok).toBe(false);
    expect(!refused.ok && refused.findings[0]!.message).toMatch(/says how a number is said, and this field is a string/);
  });

  it("retype-field with a format says it", () => {
    const { brand: _, ...plain } = structuredClone(deals);
    const withText = { ...plain, kinds: { deal: { ...plain.kinds.deal, fields: { ...plain.kinds.deal.fields, price: { type: "string" } } } } };
    const retyped = editDocument({ ...withText, brand: { currency: "EUR" } }, [{ op: "retype-field", kind: "deal", field: "price", type: "number", format: "money" }]);
    expect(retyped.ok && retyped.said[0]).toMatch(/^deal's price changes from string to number, said as money in EUR — 10000 reads €10,000; values that convert are kept\.$/);
  });

  it("set-format changes only what a number is said as, says it, and the preview says it too", () => {
    const changed = editDocument(deals, [{ op: "set-format", kind: "deal", field: "weight", format: "money", unit: null }]);
    expect(changed.ok).toBe(true);
    if (!changed.ok) return;
    expect(changed.said).toEqual(["deal's weight is said as money in USD — 10000 reads $10,000, where it was in kg; its values are kept."]);
    expect(changed.document.kinds["deal"]!.fields["weight"]).toEqual({ type: "number", format: "money" });
    const preview = diffDocuments(deals, changed.document);
    expect(preview.breaking).toBe(false);
    expect(preview.sentences).toContain("deal's weight is now said as money in USD — 10000 reads $10,000, where it was said as in kg; its values are kept.");
    // Cleared, it is a plain number again.
    const plain = editDocument(deals, [{ op: "set-format", kind: "deal", field: "amount", format: null }]);
    expect(plain.ok && plain.said[0]).toBe("deal's amount is said as a plain number, where it was money in USD; its values are kept.");
    // A format belongs on a number.
    expect(editDocument(deals, [{ op: "set-format", kind: "deal", field: "name", format: "money" }]).ok).toBe(false);
    expect(editDocument(deals, [{ op: "set-format", kind: "deal", field: "amount" }]).ok).toBe(false);
  });
});

describe("graview check and an agent know a number is money", () => {
  it("warns when a money field has no currency to be said in", () => {
    const { brand: _, ...plain } = structuredClone(deals);
    const result = compileDocument(plain);
    const warned = result.findings.filter((finding) => finding.code === "money-currency");
    expect(warned.map((finding) => finding.path)).toEqual(["kinds.deal.fields.amount.format"]);
    expect(warned[0]!.severity).toBe("warning");
    // The app's currency, or the field's own, is enough.
    expect(compileDocument(deals).findings.some((finding) => finding.code === "money-currency")).toBe(false);
  });

  it("warns of a format on a field that holds no number", () => {
    const odd = structuredClone(deals);
    odd.kinds.deal.fields.name.format = "money";
    expect(compileDocument(odd).findings.find((finding) => finding.code === "field-format")?.path).toBe("kinds.deal.fields.name.format");
  });

  it("describeApp says what each amount is, and an act's tool schema says the number is money in USD", () => {
    const app = compiled();
    const said = describeApp(app);
    expect(said).toContain("## Amounts");
    expect(said).toContain('deal · amount: An amount of money in USD: a plain number, 1250.5 for 1,250.50 USD. 1250.5 is said "$1,250.50".');
    expect(said).toContain("deal · margin: A fraction said as a percent: 0.15 is 15%.");
    const add = app.mutations!.find((mutation) => mutation.name === "add-deal")!;
    const tool = mutationToolSchema(add as never);
    const amount = (tool.inputSchema as { properties: Record<string, Record<string, unknown>> }).properties["amount"]!;
    expect(amount).toMatchObject({ type: "number", "x-graview-format": "money", "x-graview-currency": "USD" });
    expect(amount["description"]).toMatch(/An amount of money in USD/);
  });
});

describe("a form asks for an amount as it is said", () => {
  it("a creating act's form knows the amount is money in USD", () => {
    const app = compiled();
    const add = app.mutations!.find((mutation) => mutation.name === "add-deal")!;
    const amount = formFields(add.input).find((field) => field.name === "amount");
    expect(amount).toMatchObject({ control: "number", amount: { format: "money", currency: "USD" } });
    // A declared argument that sets the field is asked for as the field is.
    const set = app.mutations!.find((mutation) => mutation.name === "set-amount")!;
    expect(formFields(set.input).find((field) => field.name === "amount")).toMatchObject({ amount: { format: "money", currency: "USD" } });
  });

  it("shows the currency's symbol, suggests an amount, and reads one written as it is said", () => {
    const money = { format: "money" as const, currency: "USD" };
    expect(amountBox(money)).toMatchObject({ prefix: "$", placeholder: "1,250.00" });
    expect(readAmount("$1,250.50", money)).toBe(1250.5);
    expect(readAmount("1250.5", money)).toBe(1250.5);
    expect(readAmount("USD 1,250", money)).toBe(1250);
    expect(readAmount("twelve", money)).toBeUndefined();
    expect(amountInBox(1250.5, money)).toBe("1,250.50");
    expect(amountInBox(10000, money)).toBe("10,000");
  });

  it("reads a percent as a fraction, a duration in its unit, and money written for another locale", () => {
    expect(readAmount("15%", { format: "percent" })).toBe(0.15);
    expect(readAmount("12.5", { format: "percent" })).toBe(0.125);
    expect(amountInBox(0.125, { format: "percent" })).toBe("12.5");
    expect(readAmount("1 h 30 min", { format: "duration" })).toBe(90);
    expect(readAmount("1:30", { format: "duration" })).toBe(90);
    expect(readAmount("90", { format: "duration" })).toBe(90);
    expect(readAmount("4:27", { format: "duration", unit: "s" })).toBe(267);
    expect(readAmount("1.250,50 €", { format: "money", currency: "EUR", locale: "de-DE" })).toBe(1250.5);
    expect(readAmount("12 kg", { unit: "kg" })).toBe(12);
  });
});
