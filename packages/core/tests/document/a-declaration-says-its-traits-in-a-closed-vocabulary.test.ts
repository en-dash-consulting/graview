import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { hasTrait, TRAIT_WORDS, TRAITS, traitsOf, type Trait, type TraitName } from "../../src/compose.js";
import { readDocument, type GraviewDocument } from "../../src/document/index.js";
import { createSchema, defineApp, defineNode, z } from "../../src/index.js";

/**
 * A DECLARATION SAYS ITS TRAITS IN A CLOSED VOCABULARY (Roadmap
 * f-document-traits). The starter asks a model which of fourteen structural
 * traits a sentence needs — people who own things, a status that moves,
 * money against a budget — and matches them against what each template is
 * made of. That reading is the framework's: `traitsOf` reads a document's
 * traits off its declaration, never off hand-written tags, naming the
 * kinds, fields, relations, rules, lenses and acts that carry each and
 * saying it in one sentence. Conservative, as `inferJobs` is: read only
 * where the declaration leaves no doubt.
 */
const catalog = JSON.parse(readFileSync(new URL("./fixtures/cloud-catalog.json", import.meta.url), "utf8")) as { id: string; document: GraviewDocument }[];
const template = (id: string) => catalog.find((one) => one.id === id)!.document;
const read = (raw: Record<string, unknown>): GraviewDocument => {
  const found = readDocument({ format: "graview-document", formatVersion: 1, ...raw });
  if (!found.document) throw new Error(JSON.stringify(found.findings));
  return found.document;
};
const names = (traits: readonly Trait[]) => traits.map((trait) => trait.trait);
const trait = (document: GraviewDocument, name: TraitName) => traitsOf(document).find((one) => one.trait === name);

/** What each of Cloud's templates is made of, as read on 2026-10-27: a change here is a change in the reading, to be meant. */
const CATALOG_TRAITS: Readonly<Record<string, readonly TraitName[]>> = {
  "book-writing": ["status", "schedule", "sources"],
  "bug-bash": ["owners", "status"],
  "club-season": ["owners", "status", "schedule", "roster"],
  "content-calendar": ["owners", "status", "schedule", "publishing"],
  discography: ["status", "history"],
  "event-run-of-show": ["owners", "status", "places", "roster"],
  "gift-exchange": ["owners", "status", "schedule", "budget", "places", "private", "roster"],
  "hiring-loop": ["owners", "status", "schedule", "roster"],
  "household-chores": ["owners", "routines"],
  "job-search": ["status", "schedule", "roster"],
  "league-record-book": ["status", "schedule", "places", "history"],
  "market-map": ["status", "sources", "votes"],
  "product-roadmap": ["status", "schedule", "votes", "publishing"],
  "reading-list": ["status", "sources"],
  renovation: ["owners", "status", "schedule", "budget", "places", "roster"],
  "small-inventory": ["schedule", "places", "stock"],
  "team-history": ["status", "schedule", "history", "roster"],
  "trip-planner": ["status", "schedule", "places", "roster"],
  "vendor-shortlist": ["status", "schedule", "budget", "comparison"],
  "voter-guide": ["schedule", "sources", "roster"],
  "watch-desk": ["status", "schedule", "sources"],
  website: ["owners", "status", "publishing"],
};

describe("the vocabulary", () => {
  it("is fourteen traits, closed, each said in a person's words", () => {
    expect(TRAITS).toEqual(["owners", "status", "schedule", "budget", "places", "sources", "stock", "votes", "private", "history", "publishing", "roster", "routines", "comparison"]);
    for (const name of TRAITS) expect(TRAIT_WORDS[name]).toMatch(/^[a-z].+[^.]$/);
    expect(TRAIT_WORDS.owners).toBe("people who own things");
    expect(TRAIT_WORDS.budget).toBe("money against a budget");
  });

  it("is answered in its own order, each trait once, carrying its words", () => {
    for (const { document } of catalog) {
      const traits = traitsOf(document);
      const order = names(traits).map((name) => TRAITS.indexOf(name));
      expect(order).toEqual([...order].sort((a, b) => a - b));
      expect(new Set(order).size).toBe(order.length);
      for (const one of traits) expect(one.words).toBe(TRAIT_WORDS[one.trait]);
    }
  });
});

describe("Cloud's templates", () => {
  it("each say their traits, read off the declaration", () => {
    expect(catalog).toHaveLength(22);
    const read = Object.fromEntries(catalog.map(({ id, document }) => [id, names(traitsOf(document))]));
    expect(read).toEqual(CATALOG_TRAITS);
  });

  it("name the kinds, fields, relations, rules, lenses and acts that carry each trait, and every one is there", () => {
    for (const { document } of catalog) {
      for (const one of traitsOf(document)) {
        expect(one.kinds.length).toBeGreaterThan(0);
        for (const kind of one.kinds) expect(document.kinds[kind]).toBeDefined();
        for (const field of one.fields) {
          const [kind, name] = field.split(".") as [string, string];
          expect(document.kinds[kind]?.fields[name] ?? document.kinds[kind]?.computed?.[name]).toBeDefined();
        }
        for (const relation of one.relations) {
          const [kind, name] = relation.split(".") as [string, string];
          expect(document.kinds[kind]?.edges?.[name]).toBeDefined();
        }
        for (const rule of one.rules) expect(document.rules?.[rule]).toBeDefined();
        for (const act of one.acts) expect(document.acts?.[act]).toBeDefined();
        const titles = (document.lenses ?? []).map((lens) => (lens as { title?: string }).title);
        for (const lens of one.lenses) expect(titles).toContain(lens);
        expect(one.said).toMatch(/^[A-Z].*\.$/);
      }
    }
  });

  it("name each template's headline rule under the trait it serves", () => {
    const served: [string, string, TraitName][] = [
      ["vendor-shortlist", "within-budget", "budget"],
      ["vendor-shortlist", "one-booked-per-category", "comparison"],
      ["household-chores", "chore-not-overdue", "routines"],
      ["household-chores", "chore-has-someone", "owners"],
      ["small-inventory", "stock-above-reorder-point", "stock"],
      ["market-map", "product-cites-a-source", "sources"],
      ["bug-bash", "blocker-has-owner", "owners"],
      ["website", "live-page-has-summary", "publishing"],
      ["renovation", "room-within-budget", "budget"],
      ["event-run-of-show", "session-fits-its-place", "places"],
      ["league-record-book", "event-has-a-season", "history"],
      ["watch-desk", "verified-cites-a-source", "sources"],
      ["gift-exchange", "gives-once", "owners"],
    ];
    for (const [id, rule, name] of served) expect(trait(template(id), name)?.rules, `${id}'s ${rule} under ${name}`).toContain(rule);
  });

  it("say each trait in one sentence a person reads", () => {
    expect(trait(template("vendor-shortlist"), "budget")?.said).toBe("Vendors' quote against each category's budget.");
    expect(trait(template("vendor-shortlist"), "comparison")?.said).toBe("Vendors compared within each category, one booked.");
    expect(trait(template("vendor-shortlist"), "status")?.said).toBe("Vendors move through researching, contacted, booked and declined.");
    expect(trait(template("household-chores"), "owners")?.said).toBe("Each chore has one of the people on it (assigned).");
    expect(trait(template("household-chores"), "routines")?.said).toBe("Chores come round again, each with when it was last done.");
    expect(trait(template("gift-exchange"), "private")?.said).toBe("Matches and Gift ideas are seen only by whose they are.");
    expect(trait(template("league-record-book"), "history")?.said).toBe("Events grouped into seasons, a record book.");
    expect(trait(template("club-season"), "roster")?.said).toBe("Players, with position and phone.");
  });

  it("carry what the vendor shortlist's budget is made of: the budget, the quote, the acts that set them and the rule that holds them", () => {
    expect(trait(template("vendor-shortlist"), "budget")).toMatchObject({ kinds: ["category", "vendor"], fields: ["category.budget", "vendor.quote"], rules: ["within-budget"], acts: ["set-budget", "set-quote"] });
    expect(trait(template("vendor-shortlist"), "status")).toMatchObject({ fields: ["vendor.status"], lenses: ["Vendors by status"], acts: ["mark-contacted", "book", "decline", "reopen", "back-to-researching"] });
  });
});

describe("reading only where the declaration leaves no doubt", () => {
  const base = { name: "Things", kinds: { thing: { fields: { name: { type: "string", required: true } }, label: "{name}" } } };

  it("reads a choice as a status only when named steps move it", () => {
    const sort = read({ ...base, kinds: { thing: { fields: { name: { type: "string", required: true }, status: { type: "enum", options: ["draft", "done"] } } } } });
    expect(hasTrait(sort, "status")).toBe(false);
    const moved = read({ ...sort, acts: { finish: { title: "Finish", on: "thing", sets: { status: "done" } } } });
    expect(trait(moved, "status")).toMatchObject({ fields: ["thing.status"], acts: ["finish"], said: "Things move through draft and done." });
    // A live album's type is not a status that moves.
    expect(hasTrait(template("discography"), "publishing")).toBe(false);
  });

  it("reads nothing off prose: a pitch that says budget declares no budget", () => {
    const pitched = read({ ...base, description: "Keep the budget honest." });
    expect(hasTrait(pitched, "budget")).toBe(false);
    const quoted = read({ ...base, kinds: { thing: { fields: { name: { type: "string", required: true }, cost: { type: "number", format: "money" } } } } });
    expect(hasTrait(quoted, "budget")).toBe(false);
    const budgeted = read({ ...quoted, kinds: { ...quoted.kinds, thing: { fields: { ...quoted.kinds["thing"]!.fields, budget: { type: "number", format: "money" } } } } });
    expect(trait(budgeted, "budget")?.said).toBe("Things' cost against each one's budget.");
  });

  it("reads a date as a schedule only when it is one a record is due by or kept on a calendar, never the day it was made", () => {
    const made = read({ ...base, kinds: { thing: { fields: { name: { type: "string", required: true }, created: { type: "date" }, lastDone: { type: "date" } } } } });
    expect(hasTrait(made, "schedule")).toBe(false);
    const due = read({ ...base, kinds: { thing: { fields: { name: { type: "string", required: true }, due: { type: "date" } } } } });
    expect(trait(due, "schedule")?.said).toBe("Things are due by a date (due).");
  });

  it("reads ownership only on a relation of one to a kind that is people", () => {
    const filed = read({ ...base, kinds: { ...base.kinds, thing: { fields: { name: { type: "string", required: true } }, edges: { owner: { to: ["folder"], cardinality: "one" } } }, folder: { fields: { name: { type: "string", required: true } } } } });
    expect(hasTrait(filed, "owners")).toBe(false);
    const owned = read({ ...base, kinds: { ...base.kinds, thing: { fields: { name: { type: "string", required: true } }, edges: { owner: { to: ["member"], cardinality: "one" } } }, member: { fields: { name: { type: "string", required: true } } } } });
    expect(trait(owned, "owners")).toMatchObject({ kinds: ["thing", "member"], relations: ["thing.owner"], said: "Each thing has one of the members on it (owner)." });
    // The people kind, declared so under any name.
    const declared = read({ ...base, kinds: { ...base.kinds, thing: { fields: { name: { type: "string", required: true } }, edges: { assignedTo: { to: ["seat"], cardinality: "one" } } }, seat: { people: true, fields: { name: { type: "string", required: true } } } } });
    expect(hasTrait(declared, "owners")).toBe(true);
  });

  it("reads a TypeScript app as the document it would be", () => {
    const task = defineNode("task", { fields: z.object({ name: z.string() }), label: (node) => node.name, edges: { owner: { to: ["person"], cardinality: "one" } } });
    const person = defineNode("person", { fields: z.object({ name: z.string() }), label: (node) => node.name });
    const app = defineApp({ name: "Chores", schema: createSchema([task, person]), mutations: [] });
    expect(names(traitsOf(app))).toEqual(["owners"]);
  });
});
