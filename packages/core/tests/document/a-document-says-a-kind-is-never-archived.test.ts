import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { compileDocument, describeApp } from "../../src/check.js";
import { diffDocuments, editDocument, planMigration, readDocument, toDocument } from "../../src/document/index.js";
import { createSchema, defineApp, defineNode, deriveMutations, z } from "../../src/index.js";

/*
 * A DOCUMENT SAYS A KIND IS NEVER ARCHIVED (FR-173). `defineNode({ archives:
 * false })` gave a TypeScript kind no archive, unarchive or merge; a document
 * had no way to say it, so a hosted app offered all three on every kind —
 * a checklist's steps, an app's settings — whether or not setting one aside
 * meant anything. `"archives": false` on a kind says it, `set-archives` edits
 * it with a sentence, and the compiled app, describeApp and the diff say it.
 */
const vendors = readDocument(JSON.parse(readFileSync(new URL("./fixtures/vendors.gdd.json", import.meta.url), "utf8"))).document!;
const neverArchived = { ...vendors, kinds: { ...vendors.kinds, category: { ...vendors.kinds.category!, archives: false as const } } };
const actsOf = (document: unknown) => {
  const compiled = compileDocument(document);
  if (!compiled.ok) throw new Error(JSON.stringify(compiled.findings));
  return { app: compiled.app, names: deriveMutations(compiled.app.schema, compiled.app.mutations ?? []).map((act) => act.name) };
};

describe("a document's kind that is never archived", () => {
  it("is given its edit and remove, and no archive, unarchive or merge; another kind keeps all five", () => {
    const { names } = actsOf(neverArchived);
    expect(names).toEqual(expect.arrayContaining(["edit-category", "remove-category", "archive-vendor", "unarchive-vendor", "merge-vendor"]));
    expect(names.filter((name) => /^(archive|unarchive|merge)-category$/.test(name))).toEqual([]);
    // Without it, the kind archives as it always did.
    expect(actsOf(vendors).names).toContain("archive-category");
  });

  it("is said by describeApp, and not when every kind archives", () => {
    expect(describeApp(actsOf(neverArchived).app)).toMatch(/## Never archived\nCategories are kept or removed, never archived or merged/);
    expect(describeApp(actsOf(vendors).app)).not.toMatch(/Never archived/);
  });

  it("is what a TypeScript kind's archives: false becomes in its document", () => {
    const step = defineNode("step", { fields: z.object({ label: z.string() }), archives: false });
    const task = defineNode("task", { fields: z.object({ label: z.string() }) });
    const back = toDocument(defineApp({ name: "Steps", schema: createSchema([step, task]) }) as never);
    expect(back.document?.kinds.step?.archives).toBe(false);
    expect(back.document?.kinds.task?.archives).toBeUndefined();
    expect(compileDocument(back.document).ok).toBe(true);
  });

  it("refuses a grant naming an act the kind no longer has", () => {
    const granted = { ...neverArchived, roles: ["planner"], policy: { grants: [{ roles: ["planner"], mutations: ["archive-category"] }] } };
    const compiled = compileDocument(granted);
    expect(compiled.ok).toBe(false);
    expect(compiled.findings.find((finding) => finding.code === "grant-act")?.message).toMatch(/"archives": false/);
  });

  it("is set and unset by set-archives, which says what the app stops and starts offering", () => {
    const off = editDocument(vendors, [{ op: "set-archives", kind: "category", archives: false }]);
    if (!off.ok) throw new Error(JSON.stringify(off.findings));
    expect(off.document.kinds.category?.archives).toBe(false);
    expect(off.said[0]).toBe("Categories are kept or removed, never archived: the app no longer offers archive-category, unarchive-category or merge-category, and a category archived before is brought back when the change lands.");
    expect(off.said.join(" ")).toMatch(/The tools an agent is offered change: archive-category, unarchive-category and merge-category are gone/);
    // The preview of the same change says the same sentence.
    expect(diffDocuments(vendors, off.document).sentences).toContain(off.said[0]);

    const on = editDocument(off.document, [{ op: "set-archives", kind: "category", archives: true }]);
    if (!on.ok) throw new Error(JSON.stringify(on.findings));
    expect(on.document.kinds.category?.archives).toBeUndefined();
    expect(on.said[0]).toMatch(/^Categories can be archived and merged again/);

    const again = editDocument(off.document, [{ op: "set-archives", kind: "category", archives: false }]);
    expect(again.ok && again.said).toEqual(["Categories are already kept or removed, never archived."]);
  });

  it("is refused by set-archives while a grant names one of the three, and says the remove-grant to send first", () => {
    const granted = { ...vendors, roles: ["planner"], policy: { grants: [{ roles: ["planner"], mutations: ["add-category", "merge-category"] }] } };
    const refused = editDocument(granted, [{ op: "set-archives", kind: "category", archives: false }]);
    expect(refused.ok).toBe(false);
    if (refused.ok) return;
    expect(refused.findings[0]).toMatchObject({ code: "grant-unknown-mutation", path: "edits.0.archives" });
    expect(refused.findings[0]!.fix).toMatch(/"op": "remove-grant"/);
    // And add-grant refuses to name one on a kind that is never archived.
    const naming = editDocument(neverArchived, [{ op: "add-grant", roles: ["planner"], mutations: ["unarchive-category"] }]);
    expect(naming.ok).toBe(false);
  });
});

/*
 * AND NO RECORD IS LEFT WHERE NOTHING CAN BRING IT BACK. A kind turned to
 * never archived has no `unarchive-<kind>`, so a record already archived
 * would stay out of every list for good: the migration that lands the
 * change brings each back in the same op, and says how many. Every other
 * change keeps an archived record archived — a migration used to clear the
 * mark on every record it touched, and said nothing.
 */
describe("a change landed on records already archived", () => {
  const stored = {
    nodes: [
      { id: "category:flowers", kind: "category", name: "Flowers", $archived: true },
      { id: "category:cake", kind: "category", name: "Cake", $archived: true },
      { id: "category:music", kind: "category", name: "Music" },
      { id: "vendor:bloom", kind: "vendor", name: "Bloom", status: "researching", $archived: true },
    ],
    edges: [],
  };

  it("keeps them archived where the kind still archives", () => {
    const after = editDocument(vendors, [{ op: "add-field", kind: "category", field: "notes", spec: { type: "text" } }]);
    if (!after.ok) throw new Error(JSON.stringify(after.findings));
    const plan = planMigration(vendors, after.document, stored);
    expect(plan.primitives).toEqual([]);
    expect(plan.counts.broughtBack).toBe(0);
  });

  it("brings them back, in the same op and said, where the kind is now never archived — and only that kind's", () => {
    const off = editDocument(vendors, [{ op: "set-archives", kind: "category", archives: false }]);
    if (!off.ok) throw new Error(JSON.stringify(off.findings));
    const plan = planMigration(vendors, off.document, stored);
    expect(plan.counts.broughtBack).toBe(2);
    expect(plan.words).toEqual(["2 archived category records brought back, since category is now kept or removed, never archived."]);
    expect(plan.primitives.map((primitive) => (primitive.op === "patch-node" ? primitive.id : primitive.op))).toEqual(["category:flowers", "category:cake"]);
    // Nothing is lost by it: the change is not one a person must acknowledge.
    expect(plan.counts.cleared + plan.counts.removedNodes).toBe(0);
  });
});
