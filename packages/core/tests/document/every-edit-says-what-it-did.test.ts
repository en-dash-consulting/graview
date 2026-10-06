import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { EDIT_OPS, editDocument, readDocument } from "../../src/document/index.js";
import { compileDocument } from "../../src/check.js";

/** FR-34: every edit in the vocabulary says what it did, and the document it leaves still compiles. */
const vendors = readDocument(JSON.parse(readFileSync(new URL("./fixtures/vendors.gdd.json", import.meta.url), "utf8"))).document!;
const ONE_OF_EACH: Record<(typeof EDIT_OPS)[number], Record<string, unknown>> = {
  "add-kind": { op: "add-kind", kind: "venue", fields: { name: { type: "string", required: true } } },
  "rename-kind": { op: "rename-kind", kind: "category", to: "role" },
  "remove-kind": { op: "remove-kind", kind: "category" },
  "add-field": { op: "add-field", kind: "vendor", field: "phone", spec: { type: "string" } },
  "rename-field": { op: "rename-field", kind: "vendor", field: "quote", to: "price" },
  "retype-field": { op: "retype-field", kind: "vendor", field: "notes", type: "text" },
  "set-options": { op: "set-options", kind: "vendor", field: "status", add: ["shortlisted"] },
  "set-required": { op: "set-required", kind: "vendor", field: "notes", required: false },
  "set-default": { op: "set-default", kind: "category", field: "budget", default: 0 },
  "remove-field": { op: "remove-field", kind: "vendor", field: "notes" },
  "add-relation": { op: "add-relation", kind: "vendor", relation: "recommendedBy", to: ["vendor"] },
  "rename-relation": { op: "rename-relation", kind: "vendor", relation: "fills", to: "covers" },
  "remove-relation": { op: "remove-relation", kind: "vendor", relation: "fills" },
  "add-act": { op: "add-act", act: "mark-booked", title: "Mark booked", on: "vendor", sets: { status: "booked" } },
  "remove-act": { op: "remove-act", act: "decline" },
  "add-rule": { op: "add-rule", rule: "named", over: "vendor", require: "len(name) > 0" },
  "remove-rule": { op: "remove-rule", rule: "within-budget" },
  "set-brand": { op: "set-brand", accent: "#2f6f4e" },
  "set-label": { op: "set-label", kind: "vendor", label: "{name} ({status})" },
  "set-describe": { op: "set-describe", kind: "vendor", describe: "{status}" },
  "set-view": { op: "set-view", kind: "vendor", slot: "card", blocks: [{ title: "{name}" }] },
  "set-glance": { op: "set-glance", kind: "vendor", fields: ["status", "quote"] },
  "add-lens": { op: "add-lens", title: "The shortlist", on: "vendor", options: { blocks: [{ headline: "{count(all('vendor')) | words} vendors" }, { list: "all('vendor')", sort: "name", as: "row" }] } },
  "remove-lens": { op: "remove-lens", title: "The shortlist" },
  "set-home": { op: "set-home", blocks: [{ headline: "The wedding" }, { figure: "sum(all('vendor'), quote)", as: "money", currency: "USD", label: "Quoted so far" }] },
  "arrange-pages": { op: "arrange-pages", order: ["vendor", "category"], first: "vendors" },
  "set-computed": { op: "set-computed", kind: "category", name: "spent", expr: "sum(in('fills'), quote)", label: "Quoted" },
};
/** An edit that needs something the fixture does not have, and what to do first. */
const FIRST: Partial<Record<(typeof EDIT_OPS)[number], Record<string, unknown>>> = { "remove-lens": ONE_OF_EACH["add-lens"] };

describe("every edit says what it did", () => {
  it.each(EDIT_OPS.map((op) => [op]))("%s", (op) => {
    const first = FIRST[op];
    const base = first ? editDocument(vendors, [first]) : undefined;
    if (base && !base.ok) throw new Error(JSON.stringify(base.findings));
    const outcome = editDocument(base?.ok ? base.document : vendors, [ONE_OF_EACH[op]]);
    if (!outcome.ok) throw new Error(JSON.stringify(outcome.findings));
    expect(outcome.said.length).toBeGreaterThan(0);
    for (const sentence of outcome.said) expect(sentence).toMatch(/\S.*[.)]$/);
    const compiled = compileDocument(outcome.document);
    expect(compiled.ok, JSON.stringify(compiled.findings.filter((finding) => finding.severity === "error"))).toBe(true);
  });
});

describe("a rename that moves the tools says so", () => {
  it("rename-field: the acts that ask for it, and the derived edit", () => {
    const outcome = editDocument(vendors, [{ op: "rename-field", kind: "vendor", field: "quote", to: "price" }]);
    if (!outcome.ok) throw new Error("refused");
    const said = outcome.said.join(" ");
    expect(said).toMatch(/The tools an agent is offered change: .*set-quote is now set-price/);
    expect(said).toMatch(/edit-vendor asks for price where it asked for quote/);
    expect(outcome.document.acts?.["set-price"]).toBeDefined();
  });

  it("rename-kind: the acts named for it, and the derived edit and remove — with their grants", () => {
    const outcome = editDocument(vendors, [{ op: "rename-kind", kind: "vendor", to: "supplier" }]);
    if (!outcome.ok) throw new Error("refused");
    const said = outcome.said.join(" ");
    for (const moved of ["add-vendor is now add-supplier", "edit-vendor is now edit-supplier", "remove-vendor is now remove-supplier"]) expect(said).toContain(moved);
  });

  it("an edit that moves no tool says nothing about tools", () => {
    const outcome = editDocument(vendors, [{ op: "set-describe", kind: "vendor", describe: "{status}" }]);
    if (!outcome.ok) throw new Error("refused");
    expect(outcome.said.join(" ")).not.toMatch(/tools/);
  });
});
