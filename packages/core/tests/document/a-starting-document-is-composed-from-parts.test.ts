import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { compileDocument, designFindings } from "../../src/check.js";
import { breakingOf, composeDesign, composeReshape, startingDocument, TRAITS, traitsOf, type Part, type TraitName } from "../../src/compose.js";
import { editDocument, readDocument, type GraviewDocument } from "../../src/document/index.js";

/**
 * A STARTING DOCUMENT IS COMPOSED FROM PARTS (Roadmap f-compose-from-parts).
 * A person who says "kinda" to a template keeps some of its parts, drops
 * others and asks for parts it lacks; one nothing fits composes from what
 * they described alone. `startingDocument` starts from a template's document
 * or from nothing, takes a dropped kind out with what only it served, takes
 * a dropped trait's carriers out, brings each added trait's module in
 * joined to the kind people see most, and says what it took from where.
 * The result compiles with no warning, on every template in Cloud's catalog
 * and on nothing; `composeDesign` then gives it its jobs and look.
 */
const catalog = JSON.parse(readFileSync(new URL("./fixtures/cloud-catalog.json", import.meta.url), "utf8")) as { id: string; document: GraviewDocument }[];
const template = (id: string) => catalog.find((one) => one.id === id)!.document;
const read = (raw: Record<string, unknown>): GraviewDocument => {
  const found = readDocument({ format: "graview-document", formatVersion: 1, ...raw });
  if (!found.document) throw new Error(JSON.stringify(found.findings));
  return found.document;
};
/** Errors and warnings alike: a starting document is handed on with neither. */
const problems = (document: GraviewDocument) =>
  compileDocument(document)
    .findings.filter((finding) => finding.severity === "error" || finding.severity === "warning")
    .map((finding) => `${finding.severity} ${finding.code} ${finding.path}: ${finding.message}`);
const notDone = (said: readonly string[]) => said.filter((sentence) => sentence.startsWith("Not done"));
const parts = (took: readonly Part[], what: Part["what"]) => took.filter((part) => part.what === what).map((part) => part.part);
const traitNames = (document: GraviewDocument) => traitsOf(document).map((trait) => trait.trait);

describe("every trait module", () => {
  it("composes onto nothing, and the document compiles with no warning", () => {
    for (const trait of TRAITS) {
      const made = startingDocument({ name: "Things", add: [trait] });
      expect(problems(made.document), `nothing + ${trait}`).toEqual([]);
      expect(notDone(made.said), `nothing + ${trait}`).toEqual([]);
      expect(traitNames(made.document), `nothing + ${trait} carries it`).toContain(trait);
    }
  });

  it("composes onto every template in the catalog, and each compiles with no warning", () => {
    for (const trait of TRAITS) {
      for (const { id, document } of catalog) {
        const made = startingDocument({ base: document, name: document.name, add: [trait] });
        expect(problems(made.document), `${id} + ${trait}`).toEqual([]);
        expect(notDone(made.said), `${id} + ${trait}`).toEqual([]);
        expect(traitNames(made.document), `${id} + ${trait} carries it`).toContain(trait);
      }
    }
  });

  it("composes all together onto nothing, each joining the one kind, and composeDesign has nothing left to warn of", () => {
    const made = startingDocument({ name: "Everything", add: [...TRAITS] });
    expect(problems(made.document)).toEqual([]);
    expect(traitNames(made.document)).toEqual([...TRAITS]);
    const designed = editDocument(made.document, composeDesign(made.document).edits);
    expect(designed.ok).toBe(true);
    if (designed.ok) expect(designFindings(designed.document).filter((finding) => finding.severity === "warning")).toEqual([]);
  });
});

describe("dropping", () => {
  it("any one kind of any template leaves a document that compiles with no warning", () => {
    for (const { id, document } of catalog) {
      for (const kind of Object.keys(document.kinds)) {
        const made = startingDocument({ base: document, name: document.name, drop: [kind] });
        // By its own key: a kind may be called "constructor" (the league record book's is), which every object inherits.
        expect(Object.hasOwn(made.document.kinds, kind), `${id} - ${kind}`).toBe(false);
        expect(problems(made.document), `${id} - ${kind}`).toEqual([]);
        expect(made.left.map((part) => part.part), `${id} - ${kind}`).toContain(kind);
      }
    }
  });

  it("a kind takes with it the rules, lenses, acts and relations only it served, and leaves the rest standing", () => {
    const made = startingDocument({ base: template("vendor-shortlist"), name: "Vendors", drop: ["category"] });
    expect(made.document.kinds["category"]).toBeUndefined();
    expect(made.document.kinds["vendor"]!.edges?.["fills"]).toBeUndefined();
    expect(Object.keys(made.document.rules ?? {})).toEqual(["booked-needs-quote"]);
    expect(Object.keys(made.document.acts ?? {})).not.toContain("add-category");
    expect(Object.keys(made.document.acts ?? {})).toContain("book");
    expect((made.document.lenses ?? []).map((lens) => (lens as { title: string }).title)).toEqual(["Vendors by status", "Deadlines"]);
    expect(made.left).toContainEqual({ part: "category", what: "kind", from: "Vendor shortlist" });
    expect(parts(made.took, "kind")).toEqual(["vendor"]);
    expect(made.document.name).toBe("Vendors");
  });

  it("any one trait of any template leaves a document that compiles with no warning", () => {
    for (const { id, document } of catalog) {
      for (const trait of traitNames(document)) {
        const made = startingDocument({ base: document, name: document.name, drop: [trait] });
        expect(problems(made.document), `${id} - ${trait}`).toEqual([]);
        expect(notDone(made.said), `${id} - ${trait}`).toEqual([]);
        expect(made.left, `${id} - ${trait}`).toContainEqual({ part: trait, what: "trait", from: document.name });
      }
    }
  });

  it("a trait takes what only it carries, and leaves a carrier another trait shares", () => {
    const budgetless = startingDocument({ base: template("vendor-shortlist"), name: "Vendors", drop: ["budget"] });
    expect(budgetless.document.kinds["category"]!.fields["budget"]).toBeUndefined();
    expect(budgetless.document.rules?.["within-budget"]).toBeUndefined();
    expect(budgetless.document.kinds["category"], "the grouping kind stands").toBeDefined();
    expect(traitNames(budgetless.document)).toEqual(["status", "schedule", "comparison"]);
    // The status board stands on the field the publish step also moves: dropping publishing keeps the status.
    const unpublished = startingDocument({ base: template("content-calendar"), name: "Content", drop: ["publishing"] });
    expect(unpublished.document.kinds["piece"]!.fields["status"]).toBeDefined();
    expect(traitNames(unpublished.document)).toContain("status");
    expect(traitNames(unpublished.document)).not.toContain("publishing");
  });

  it("says what it has no part called, and keeps the last kind", () => {
    const made = startingDocument({ base: template("household-chores"), name: "Chores", drop: ["guest", "person", "area", "chore"] });
    expect(made.said).toContain("Chores has no kind called guest to leave out.");
    expect(Object.keys(made.document.kinds)).toEqual(["chore"]);
    expect(made.said).toContain("Chores keeps at least one kind, so chore stays.");
    expect(problems(made.document)).toEqual([]);
  });
});

describe("what a module brings", () => {
  it("joins the kind people see most rather than standing apart: an owner on the vendors, not a person alone", () => {
    const made = startingDocument({ base: template("vendor-shortlist"), name: "Vendors", add: ["owners"] });
    expect(made.document.kinds["person"]).toBeDefined();
    expect(made.document.kinds["vendor"]!.edges?.["owner"]).toMatchObject({ to: ["person"], cardinality: "one" });
    expect(made.document.rules?.["vendor-has-an-owner"]).toMatchObject({ over: "vendor", require: "present(owner)", repairs: [{ act: "give-vendor" }] });
    expect(made.took).toContainEqual({ part: "person", what: "kind", from: "owners" });
    expect(made.took).toContainEqual({ part: "vendor.owner", what: "relation", from: "owners" });
    expect(made.took).toContainEqual({ part: "vendor-has-an-owner", what: "rule", from: "owners" });
    expect(made.took).toContainEqual({ part: "Who has what", what: "lens", from: "owners" });
    expect(made.took).toContainEqual({ part: "owners", what: "trait", from: "owners" });
    // What the base gave, said as the base's: its kinds, its traits, its rules and its lenses.
    expect(made.took).toContainEqual({ part: "vendor", what: "kind", from: "Vendor shortlist" });
    expect(made.took).toContainEqual({ part: "budget", what: "trait", from: "Vendor shortlist" });
    expect(made.took).toContainEqual({ part: "within-budget", what: "rule", from: "Vendor shortlist" });
    expect(made.took).toContainEqual({ part: "Deadlines", what: "lens", from: "Vendor shortlist" });
  });

  it("reuses the people the base already has", () => {
    const made = startingDocument({ base: template("bug-bash"), name: "Bugs", drop: ["owners"], add: ["owners"] });
    expect(Object.keys(made.document.kinds)).toEqual(["issue", "area", "person"]);
    expect(made.document.kinds["issue"]!.edges?.["owner"]).toMatchObject({ to: ["person"] });
    expect(problems(made.document)).toEqual([]);
  });

  it("puts a budget on the kind the main kind is grouped under, and the over-budget rule over it", () => {
    // Dropping the budget took the quote with it (the money the budget held), so the module brings a cost back beside the budget.
    const base = startingDocument({ base: template("vendor-shortlist"), name: "Vendors", drop: ["budget"] }).document;
    expect(base.kinds["vendor"]!.fields["quote"]).toBeUndefined();
    const made = startingDocument({ base, name: "Vendors", add: ["budget"] });
    expect(made.document.kinds["category"]!.fields["budget"]).toMatchObject({ type: "number", format: "money" });
    expect(made.document.kinds["vendor"]!.fields["cost"]).toMatchObject({ type: "number", format: "money" });
    expect(made.document.rules?.["category-within-budget"]).toMatchObject({ over: "category", require: "sum(in('fills'), 'cost') <= budget" });
    expect(made.took).toContainEqual({ part: "category.budget", what: "field", from: "budget" });
    expect(made.took).toContainEqual({ part: "vendor.cost", what: "field", from: "budget" });
    expect(problems(made.document)).toEqual([]);
  });

  it("gives a status its named steps and a board; a comparison its chosen value and one chosen per group", () => {
    const status = startingDocument({ name: "Requests", add: ["status"] });
    expect(status.document.kinds["item"]!.fields["status"]).toMatchObject({ type: "enum", options: ["open", "doing", "done"], default: "open" });
    expect(parts(status.took, "act")).toEqual(["start-item", "finish-item", "reopen-item"]);
    expect(parts(status.took, "lens")).toEqual(["Items by status"]);
    const compared = startingDocument({ base: template("vendor-shortlist"), name: "Vendors", drop: ["comparison"], add: ["comparison"] });
    expect(compared.document.rules?.["one-booked-per-category"]).toMatchObject({ over: "category", require: "count(in('fills') where status == 'booked') <= 1" });
    expect(Object.keys(compared.document.acts ?? {})).not.toContain("choose-vendor");
    const alone = startingDocument({ name: "Options", add: ["comparison"] });
    expect(alone.document.rules?.["one-chosen"]).toMatchObject({ over: "graph", require: "count(all('item') where status == 'chosen') <= 1" });
  });

  it("keeps a kind's own records to their maker, showing the rest to everyone", () => {
    const made = startingDocument({ base: template("household-chores"), name: "Chores", add: ["private"] });
    expect(made.document.policy?.sees).toEqual([
      { roles: "*", kinds: ["person", "area"] },
      { roles: "*", kinds: ["chore"], own: true },
    ]);
    expect(traitNames(made.document)).toContain("private");
  });

  it("leaves a trait the document already carries as it is, and says so", () => {
    const made = startingDocument({ base: template("vendor-shortlist"), name: "Vendors", add: ["budget", "status"] });
    expect(made.said).toContain("Vendors already has money against a budget.");
    expect(made.said).toContain("Vendors already has a status that moves.");
    expect(JSON.stringify({ ...made.document, name: "Vendor shortlist" })).toBe(JSON.stringify(template("vendor-shortlist")));
    expect(made.took.filter((part) => part.from !== "Vendor shortlist")).toEqual([]);
  });

  it("starts a roster from the people themselves, and takes the name and the purpose", () => {
    const made = startingDocument({ name: "The squad", purpose: "A five-a-side team's players and who can make it", add: ["roster", "schedule"] });
    expect(Object.keys(made.document.kinds)).toEqual(["person"]);
    expect(made.document.kinds["person"]!.fields).toMatchObject({ name: { type: "string" }, role: { type: "string" }, email: { type: "email" }, phone: { type: "phone" }, due: { type: "date" } });
    expect(made.document.name).toBe("The squad");
    expect(made.document.purpose?.for).toBe("A five-a-side team's players and who can make it");
    expect(problems(made.document)).toEqual([]);
  });

  it("starts from nothing with one kind when nothing is asked for", () => {
    const made = startingDocument({ name: "Stuff" });
    expect(Object.keys(made.document.kinds)).toEqual(["item"]);
    expect(made.took).toEqual([{ part: "item", what: "kind", from: "nothing" }]);
    expect(problems(made.document)).toEqual([]);
  });
});

describe("the editor, taking a kind out", () => {
  const santa = template("gift-exchange");

  it("takes the kind's hue with it, and moves it with a rename", () => {
    const hued = read({ ...template("bug-bash"), brand: { accents: { area: 120, issue: 30 } } });
    const removed = editDocument(hued, [{ op: "remove-kind", kind: "area" }]);
    expect(removed.ok && removed.document.brand).toEqual({ accents: { issue: 30 } });
    expect(removed.ok && removed.said.join(" ")).toContain("its hue");
    const renamed = editDocument(hued, [{ op: "rename-kind", kind: "area", to: "zone" }]);
    expect(renamed.ok && renamed.document.brand).toEqual({ accents: { zone: 120, issue: 30 } });
    const gone = editDocument(hued, [{ op: "remove-kind", kind: "area" }, { op: "remove-kind", kind: "issue" }]);
    expect(gone.ok && gone.document.brand).toBeUndefined();
  });

  it("takes the acts on the acting person's own record with the people kind, and the sights through its relations", () => {
    expect(santa.kinds["participant"]!.people).toBe(true);
    const removed = editDocument(santa, [{ op: "remove-kind", kind: "participant" }]);
    expect(removed.ok).toBe(true);
    if (!removed.ok) return;
    expect(removed.document.acts?.["update-my-wishlist"]).toBeUndefined();
    expect(removed.document.policy?.sees?.some((sight) => sight.via !== undefined)).toBe(false);
    expect(removed.said.join(" ")).toContain('the sights through "givenBy" and "giftFrom"');
    expect(problems(removed.document)).toEqual([]);
  });
});

/** Every trait is a module: the record of the vocabulary and the composer agreeing. */
it("every name in the vocabulary has a module", () => {
  const made = Object.fromEntries(TRAITS.map((trait) => [trait, parts(startingDocument({ name: "Things", add: [trait] }).took, "trait")]));
  expect(made).toEqual(Object.fromEntries(TRAITS.map((trait) => [trait, [trait]])) as Record<TraitName, string[]>);
});

/**
 * THE EDITS THAT TOOK ARE THE CHANGE (Roadmap f-seat-reshape): a host that
 * applies a declaration's changes through its own path — a proposal a
 * person accepts, one undo — applies `edits` to the base in one call and
 * gets the same document the composer handed on.
 */
describe("the edits a starting document took", () => {
  it("replay onto the base as one change, giving the composed document, on every template and trait", () => {
    for (const { id, document } of catalog) {
      for (const trait of TRAITS) {
        const made = startingDocument({ base: document, name: document.name, add: [trait] });
        const replayed = editDocument(document, made.edits);
        expect(replayed.ok, `${id} + ${trait} replays`).toBe(true);
        if (!replayed.ok) continue;
        expect(replayed.document, `${id} + ${trait} is the same document`).toEqual(made.document);
      }
    }
  });

  it("are none for a trait the base already carries, and name a drop as its own remove edits", () => {
    const chores = template("household-chores");
    expect(startingDocument({ base: chores, name: chores.name, add: ["owners"] }).edits).toEqual([]);
    const dropped = startingDocument({ base: chores, name: chores.name, drop: ["area"] });
    expect(dropped.edits.map((edit) => edit.op)).toContain("remove-kind");
    expect(dropped.left.map((part) => part.part)).toContain("area");
  });
});

/**
 * A CHANGE A SEAT READ OFF A PERSON'S WORDS IS COMPOSED BY THE HOST (Roadmap
 * f-seat-reshape): `composeReshape` takes the reading as the person left it
 * on the card — the traits to add, the kinds and traits to drop — and
 * answers the starting document's edits with what each removal loses said.
 */
describe("a reshape composed from a seat's reading", () => {
  it("adds a person kind and an owner link to the vendor shortlist for people who own things, losing nothing", () => {
    const shortlist = template("vendor-shortlist");
    const made = composeReshape({ document: shortlist, add: ["owners"], drop: [] });
    expect(made.edits.find((edit) => edit.op === "add-kind")).toMatchObject({ kind: "person" });
    expect(made.edits.find((edit) => edit.op === "add-relation")).toMatchObject({ kind: "vendor", relation: "owner", to: ["person"] });
    expect(made.breaking).toEqual([]);
    expect(made.notDone).toEqual([]);
    expect(problems(made.document)).toEqual([]);
    expect(editDocument(shortlist, made.edits)).toMatchObject({ ok: true, document: made.document });
  });

  it("says what a dropped kind, field and relation lose, and nothing for a rule or a view", () => {
    const shortlist = template("vendor-shortlist");
    expect(breakingOf(shortlist, { op: "remove-kind", kind: "category" })).toBe("All categories records go, with their links.");
    expect(breakingOf(shortlist, { op: "remove-field", kind: "vendor", field: "quote" })).toBe("Vendor's quote values go.");
    expect(breakingOf(shortlist, { op: "remove-relation", kind: "vendor", relation: "category" })).toBe("The vendor → category links go.");
    expect(breakingOf(shortlist, { op: "remove-rule", rule: "over-budget" })).toBeUndefined();
    expect(breakingOf(shortlist, { op: "remove-lens", title: "Compared" })).toBeUndefined();
    const dropped = composeReshape({ document: shortlist, add: [], drop: ["category"] });
    expect(dropped.breaking).toEqual(["All categories records go, with their links."]);
    expect(dropped.left.map((part) => part.part)).toContain("category");
  });
});
