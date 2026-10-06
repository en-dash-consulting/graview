import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { diffDocuments, editDocument, losesData, parseExpr, planMigration, printExpr, readDocument, type Expr, type GraviewDocument } from "../../src/document/index.js";
import { compileDocument } from "../../src/check.js";

const template = JSON.parse(readFileSync(new URL("./fixtures/vendor-shortlist.template.json", import.meta.url), "utf8"));
const vendors = readDocument(template.document).document!;

const graph = {
  nodes: [
    { id: "florist", kind: "category", name: "Florist", budget: 3000 },
    { id: "bloom", kind: "vendor", name: "Bloom & Co", status: "booked", quote: 2400 },
    { id: "petal", kind: "vendor", name: "Petal", status: "contacted", quote: 1800, notes: "nice" },
  ],
  edges: [{ kind: "fills", from: "bloom", to: "florist" }],
};

/** Edit, then prove the result compiles clean under the framework's own check too. */
function edited(edits: unknown[], from: GraviewDocument = vendors) {
  const out = editDocument(from, edits);
  if (!out.ok) throw new Error(JSON.stringify(out.findings));
  const compiled = compileDocument(out.document);
  if (!compiled.ok) throw new Error(JSON.stringify(compiled.findings.filter((f) => f.severity === "error")));
  return { ...out, diff: diffDocuments(from, out.document), plan: planMigration(from, out.document, graph, { fills: out.fills }) };
}

const refused = (edits: unknown[]) => {
  const out = editDocument(vendors, edits);
  if (out.ok) throw new Error("expected a refusal");
  return out.findings.map((f) => `${f.path}: ${f.message}`).join("\n");
};

const strip = (e: Expr): unknown => JSON.parse(JSON.stringify(e, (k, v) => (k === "at" ? undefined : v)));

describe("the rule language prints back to what it parsed", () => {
  const sources = [
    "status == 'booked'",
    "sum(in('fills') where status == 'booked', 'quote') <= budget",
    "count(in('fills') where status == 'booked') <= 1",
    "not (a and b) or c",
    "not a == b",
    "(not a) == b",
    "a - (b - c)",
    "(a + b) * c",
    "-(a + b)",
    "- -a",
    "fills.name == 'x' and present(due)",
    "(out('fills') where budget > 0).name",
    "every(out('fills'), budget != null)",
    "if(status == 'booked', 'good', if(x, 'a', 'b'))",
    "'it\\'s' in [1, 2.5, null, true]",
    "days(today(), due) < 7 and status != 'declined'",
    "count(all('vendor') where status == 'booked' and fills == null) >= 0",
  ];
  for (const s of sources) {
    it(s, () => {
      const tree = parseExpr(s);
      expect(strip(parseExpr(printExpr(tree)))).toEqual(strip(tree));
    });
  }
});

describe("rename-field: the values move and every mention follows", () => {
  const out = edited([{ op: "rename-field", kind: "vendor", field: "quote", to: "price" }]);
  const doc = out.document as any;

  it("declares the rename so the records keep their values", () => {
    expect(doc.kinds.vendor!.fields["price"]).toMatchObject({ type: "number", renamedFrom: "quote" });
    expect(doc.kinds.vendor!.fields["quote"]).toBeUndefined();
    expect(out.plan.counts).toMatchObject({ moved: 2, cleared: 0 });
    expect(losesData(out.plan)).toBe(false);
    expect(out.diff.sentences).toContain("vendor's quote is renamed to price; its values are kept.");
    expect(out.diff.removedFields).toEqual([]);
  });

  it("rewrites rules — the quoted field of sum() and the bare one alike", () => {
    expect(doc.rules["within-budget"].require).toBe("sum(in('fills') where status == 'booked', 'price') <= budget");
    expect(doc.rules["booked-needs-quote"].require).toBe("price != null");
    expect(doc.rules["booked-needs-quote"].title).toBe("A booked vendor has a price");
  });

  it("rewrites templates, the act that writes it (and its name), its repairs and the view", () => {
    expect(doc.kinds.vendor!.describe).toBe("{status} · {price|money}");
    expect(doc.acts["set-quote"]).toBeUndefined();
    expect(doc.acts["set-price"]).toMatchObject({ writes: ["price"], title: "Set the price" });
    expect(doc.rules["booked-needs-quote"].repairs[0].act).toBe("set-price");
    expect(doc.views.vendor.card).toContainEqual({ field: "price", as: "money" });
    expect(out.said[0]).toMatch(/quote is renamed to price; its values are kept, and .*rule within-budget.* now say price/);
  });

  it("leaves untouched text exactly as it was", () => {
    expect(doc.rules["one-booked-per-category"].require).toBe(vendors.rules!["one-booked-per-category"]!.require);
    expect(doc.views.vendor.card[1]).toEqual((vendors as any).views.vendor.card[1]);
  });

  it("does not touch a word in quotes, or another kind's field of the same name", () => {
    const base = edited([
      { op: "add-field", kind: "category", field: "quote", type: "string" },
      { op: "add-rule", rule: "says-quote", over: "category", when: "quote == 'quote'", require: "present(name)" },
    ]).document;
    const doc2 = edited([{ op: "rename-field", kind: "vendor", field: "quote", to: "price" }], base).document as any;
    expect(doc2.rules["says-quote"].when).toBe("quote == 'quote'");
    expect(doc2.kinds.category.fields.quote).toBeDefined();
  });

  it("twice in one change keeps the first name as where the values come from", () => {
    const twice = edited([
      { op: "rename-field", kind: "vendor", field: "quote", to: "price" },
      { op: "rename-field", kind: "vendor", field: "price", to: "cost" },
    ]);
    expect(twice.document.kinds.vendor!.fields["cost"]).toMatchObject({ renamedFrom: "quote" });
    expect(twice.plan.counts.moved).toBe(2);
  });

  it("a field added in the same change has no values to move", () => {
    const fresh = edited([
      { op: "add-field", kind: "vendor", field: "deposit", type: "number" },
      { op: "rename-field", kind: "vendor", field: "deposit", to: "paid" },
    ]);
    expect(fresh.document.kinds.vendor!.fields["paid"]!.renamedFrom).toBeUndefined();
  });

  it("refuses a name the rule language keeps, or one already taken", () => {
    expect(refused([{ op: "rename-field", kind: "vendor", field: "quote", to: "where" }])).toMatch(/keeps/);
    expect(refused([{ op: "rename-field", kind: "vendor", field: "quote", to: "status" }])).toMatch(/already has a field called "status"/);
    expect(refused([{ op: "rename-field", kind: "vendor", field: "price", to: "cost" }])).toMatch(/vendor has no field "price"/);
  });
});

describe("rename-relation and rename-kind", () => {
  it("a relation's links move, and out()/in() and the acts that make and break it follow", () => {
    const out = edited([{ op: "rename-relation", kind: "vendor", relation: "fills", to: "filedUnder" }]);
    const doc = out.document as any;
    expect(doc.kinds.vendor.edges.filedUnder).toMatchObject({ renamedFrom: "fills" });
    expect(doc.rules["one-booked-per-category"].require).toBe("count(in('filedUnder') where status == 'booked') <= 1");
    expect(doc.acts["file-under"].connects).toBe("filedUnder");
    expect(doc.acts["unfile"].severs).toBe("filedUnder");
    expect(doc.acts["add-to-category"].effects[1].connect).toBe("filedUnder");
    expect(out.plan.counts.removedEdges).toBe(0);
    expect(out.plan.primitives).toContainEqual({ op: "add-edge", edge: { kind: "filedUnder", from: "bloom", to: "florist" } });
    expect(out.diff.breaking).toBe(false);
  });

  it("a kind's records move, and everything that names it follows — acts named for it too", () => {
    const out = edited([{ op: "rename-kind", kind: "vendor", to: "supplier" }]);
    const doc = out.document as any;
    expect(doc.kinds.supplier).toMatchObject({ renamedFrom: "vendor", noun: "supplier", plural: "suppliers" });
    expect(doc.kinds.vendor).toBeUndefined();
    expect(doc.acts["add-supplier"]).toMatchObject({ creates: "supplier", title: "Add a supplier" });
    expect(doc.acts["add-vendor"]).toBeUndefined();
    expect(doc.acts.book.on).toBe("supplier");
    expect(doc.acts["add-to-category"].effects[0].create).toBe("supplier");
    expect(doc.rules["booked-needs-quote"].over).toBe("supplier");
    expect(doc.views.supplier.card).toBeDefined();
    expect(out.plan.counts.removedNodes).toBe(0);
    expect(losesData(out.plan)).toBe(false);
    expect(out.diff.sentences).toContain("The vendor kind is renamed to supplier; its records are kept.");
  });

  it("all('kind') follows a renamed kind", () => {
    const base = edited([{ op: "add-rule", rule: "few", over: "graph", require: "count(all('vendor')) < 100" }]).document;
    const doc = edited([{ op: "rename-kind", kind: "vendor", to: "supplier" }], base).document as any;
    expect(doc.rules.few.require).toBe("count(all('supplier')) < 100");
  });
});

describe("removals take with them what cannot stand", () => {
  it("remove-field: the act that only wrote it, the rules that judged it, the view block and template that showed it", () => {
    const out = edited([{ op: "remove-field", kind: "vendor", field: "quote" }]);
    const doc = out.document as any;
    expect(doc.kinds.vendor.fields.quote).toBeUndefined();
    expect(doc.acts["set-quote"]).toBeUndefined();
    expect(doc.rules["booked-needs-quote"]).toBeUndefined();
    expect(doc.rules["within-budget"]).toBeUndefined();
    expect(doc.rules["one-booked-per-category"]).toBeDefined();
    expect(doc.kinds.vendor.describe).toBeUndefined();
    expect(doc.views.vendor.card.some((b: any) => b.field === "quote")).toBe(false);
    expect(out.plan.counts.cleared).toBe(2);
    expect(losesData(out.plan)).toBe(true);
    expect(out.said[0]).toMatch(/vendor loses its quote field, and every value in it; .*act set-quote/);
  });

  it("an act that also does something else keeps that, and loses only the field", () => {
    const base = edited([{ op: "add-act", act: "quote-and-contact", on: "vendor", writes: ["quote"], sets: { status: "contacted" } }]).document;
    const doc = edited([{ op: "remove-field", kind: "vendor", field: "quote" }], base).document as any;
    expect(doc.acts["quote-and-contact"]).toEqual({ on: "vendor", sets: { status: "contacted" } });
  });

  it("a removed field with no values in it loses nothing", () => {
    const out = edited([{ op: "remove-field", kind: "vendor", field: "site" }]);
    expect(losesData(out.plan)).toBe(false);
  });

  it("remove-relation takes the acts that make and break it, and the rules that walk it", () => {
    const out = edited([{ op: "remove-relation", kind: "vendor", relation: "fills" }]);
    const doc = out.document as any;
    for (const a of ["file-under", "unfile", "add-to-category"]) expect(doc.acts[a]).toBeUndefined();
    expect(doc.rules["one-booked-per-category"]).toBeUndefined();
    expect(out.plan.counts.removedEdges).toBe(1);
  });

  it("remove-act takes its repairs and grants", () => {
    const doc = edited([{ op: "remove-act", act: "set-quote" }]).document as any;
    expect(doc.rules["booked-needs-quote"].repairs).toBeUndefined();
  });

  it("remove-kind takes its acts, rules, views and the relations that only led to it", () => {
    const out = edited([{ op: "remove-kind", kind: "category" }]);
    const doc = out.document as any;
    expect(doc.kinds.category).toBeUndefined();
    expect(doc.kinds.vendor.edges).toBeUndefined();
    expect(doc.acts["add-category"]).toBeUndefined();
    expect(doc.rules["within-budget"]).toBeUndefined();
    expect(out.plan.counts.removedNodes).toBe(1);
  });

  it("remove-rule", () => {
    expect((edited([{ op: "remove-rule", rule: "within-budget" }]).document as any).rules["within-budget"]).toBeUndefined();
  });
});

describe("additions and settings", () => {
  it("add-field, with a value for the records already there", () => {
    const out = edited([{ op: "add-field", kind: "vendor", field: "deposit", type: "number", format: "money", fill: 0 }]);
    expect(out.document.kinds.vendor!.fields["deposit"]).toEqual({ type: "number", format: "money" });
    expect(out.fills).toEqual([{ kind: "vendor", field: "deposit", value: 0 }]);
    expect(out.plan.counts.filled).toBe(2);
    expect(losesData(out.plan)).toBe(false);
  });

  it("add-field, filled from another field", () => {
    const out = edited([{ op: "add-field", kind: "vendor", field: "budgeted", type: "number", fill: { from: "quote" } }]);
    expect(out.plan.primitives).toContainEqual(expect.objectContaining({ op: "patch-node", id: "bloom", after: { budgeted: 2400 } }));
  });

  it("a fill that does not fit the field is refused", () => {
    expect(refused([{ op: "add-field", kind: "vendor", field: "deposit", type: "number", fill: "lots" }])).toMatch(/not a number/);
  });

  it("set-options adds without loss, and removing an option in use is counted", () => {
    const add = edited([{ op: "set-options", kind: "vendor", field: "status", add: ["shortlisted"] }]);
    expect(add.document.kinds.vendor!.fields["status"]!.options).toEqual(["researching", "contacted", "booked", "declined", "shortlisted"]);
    expect(losesData(add.plan)).toBe(false);
    expect(add.diff.sentences).toContain(`vendor's status now also offers "shortlisted".`);
    const drop = edited([{ op: "set-options", kind: "vendor", field: "status", remove: ["contacted"] }]);
    expect(drop.plan.counts.defaulted).toBe(1);
    expect((drop.document as any).acts["mark-contacted"]).toBeUndefined();
    expect((drop.document as any).acts["reopen"]).toBeUndefined();
  });

  it("retype-field keeps what converts", () => {
    const out = edited([{ op: "retype-field", kind: "vendor", field: "notes", type: "string" }]);
    expect(out.document.kinds.vendor!.fields["notes"]!.type).toBe("string");
    expect(losesData(out.plan)).toBe(false);
    expect(refused([{ op: "retype-field", kind: "vendor", field: "notes", type: "enum" }])).toMatch(/options/);
  });

  it("set-required without a default counts the records that would lack it", () => {
    const out = edited([{ op: "set-required", kind: "vendor", field: "notes", required: true }]);
    expect(out.plan.missingRequired).toBe(1);
    expect(losesData(out.plan)).toBe(true);
  });

  it("set-default", () => {
    expect(edited([{ op: "set-default", kind: "vendor", field: "status", default: "contacted" }]).document.kinds.vendor!.fields["status"]!.default).toBe("contacted");
    expect(refused([{ op: "set-default", kind: "vendor", field: "status", default: "maybe" }])).toMatch(/not one of/);
  });

  it("add-kind gets an act to add one; add-relation; add-act; add-rule", () => {
    const out = edited([
      { op: "add-kind", kind: "payment", noun: "payment", fields: { amount: { type: "number", required: true }, paidOn: { type: "date" } } },
      { op: "add-relation", kind: "payment", relation: "paidTo", to: "vendor", cardinality: "one" },
      { op: "add-act", act: "pay", title: "Record a payment", on: "vendor", args: { amount: { type: "number", required: true } }, effects: [{ create: "payment", as: "p", set: { amount: "$amount", paidOn: "$today" } }, { connect: "paidTo", from: "$p", to: "$subject" }] },
      { op: "add-rule", rule: "positive-payment", over: "payment", require: "amount > 0", says: "A payment must be more than nothing" },
    ]);
    const doc = out.document as any;
    expect(doc.acts["add-payment"]).toEqual({ title: "Add a payment", description: "Add a new payment.", creates: "payment" });
    expect(doc.kinds.payment.edges.paidTo).toEqual({ to: ["vendor"], cardinality: "one" });
    expect(losesData(out.plan)).toBe(false);
  });

  it("set-brand, set-label, set-describe, set-view", () => {
    const doc = edited([
      { op: "set-brand", accent: "#2f6f4e" },
      { op: "set-label", kind: "vendor", field: "quote", label: "Quoted" },
      { op: "set-describe", kind: "vendor", describe: "{status}" },
      { op: "set-view", kind: "category", slot: "card", blocks: [{ title: "{name}" }, { field: "budget", as: "money" }] },
      { op: "set-view", kind: "vendor", slot: "card", blocks: null },
    ]).document as any;
    expect(doc.brand.accent).toBe("#2f6f4e");
    expect(doc.kinds.vendor.fields.quote.label).toBe("Quoted");
    expect(doc.kinds.vendor.describe).toBe("{status}");
    expect(doc.views.category.card).toHaveLength(2);
    expect(doc.views.vendor).toBeUndefined();
  });

  it("an unknown op, kind or key is a finding at the edit's path", () => {
    expect(refused([{ op: "rename-everything" }])).toMatch(/^edits\.0\.op: "rename-everything" is not an edit/);
    expect(refused([{ op: "add-field", kind: "venue", field: "x", type: "string" }])).toMatch(/"venue" is not a kind this app has/);
    expect(refused([{ op: "rename-field", kind: "vendor", field: "quote", to: "price", extra: 1 }])).toMatch(/"extra" is not part of rename-field/);
    expect(refused([{ op: "add-field", kind: "vendor", field: "x", type: "colour" }])).toMatch(/^edits\.0\.type/);
  });
});
