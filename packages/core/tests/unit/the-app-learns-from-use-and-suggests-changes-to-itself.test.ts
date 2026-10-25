import { describe, expect, it } from "vitest";
import { compileDocument } from "../../src/check.js";
import { editDocument, type GraviewDocument } from "../../src/document/index.js";
import { frictionEvent, type FrictionEvent } from "../../src/friction.js";
import { acceptAppSuggestion, declineAppSuggestion, learnFromUse, learningFrom, memoryLearned, type AppSuggestion, type LearnedRecord } from "../../src/learn.js";
import { Store, type AnySchema, type Author, type GraviewApp, type Operation } from "../../src/index.js";

/**
 * APPS IMPROVE FROM USE (Roadmap f-learned-suggestions). The app's own actor
 * suggests changes to the declaration itself, from evidence of use: words
 * people searched with and found nothing, values a text field keeps
 * repeating, dates written into words, the same two acts taken one after
 * the other, a place nobody opens, an agent's tool calls that went wrong.
 * Each only when several distinct people show it, never one person's habit;
 * each proposed, never applied; accepted as one change with lineage, or
 * declined for good.
 */

const wedding: GraviewDocument = {
  format: "graview-document",
  formatVersion: 1,
  name: "Wedding",
  kinds: {
    vendor: {
      noun: "vendor",
      plural: "vendors",
      fields: {
        name: { type: "string", required: true },
        category: { type: "string" },
        notes: { type: "text" },
        stage: { type: "enum", options: ["new", "shortlisted", "booked"] },
        callBack: { type: "boolean" },
        price: { type: "number", format: "money" },
      },
    },
  },
  acts: {
    "add-vendor": { title: "Add a vendor", creates: "vendor" },
    shortlist: { title: "Shortlist it", on: "vendor", sets: { stage: "shortlisted" } },
    "flag-for-call": { title: "Flag for a call", on: "vendor", sets: { callBack: true } },
    book: { title: "Book it", on: "vendor", sets: { stage: "booked" }, writes: ["price"] },
  },
  lenses: [
    { name: "columns", title: "Pipeline", bindings: { vendor: { column: "stage" } } },
    { name: "columns", title: "Old board", bindings: { vendor: { column: "stage" } } },
  ],
} as unknown as GraviewDocument;

const compiled = compileDocument(wedding);
if (!compiled.ok) throw new Error(JSON.stringify(compiled.findings, null, 2));
const app = compiled.app as GraviewApp;

const person = (id: string): Author => ({ kind: "human", id });
const ada = person("ada");
const bo = person("bo");
const cy = person("cy");
const di = person("di");

/** A store whose clock each call moves a minute on, from noon. */
function storeOf() {
  let minute = 0;
  const clock = () => new Date(Date.UTC(2026, 9, 20, 12, minute)).toISOString();
  const store = new Store<AnySchema>({ schema: app.schema, mutations: app.mutations ?? [], now: clock });
  const act = (by: Author, name: string, args: Record<string, unknown>) => {
    minute += 1;
    const result = store.apply({ name, args }, { author: by });
    return result;
  };
  const at = (offset = 0) => new Date(Date.UTC(2026, 9, 20, 12, minute + offset)).toISOString();
  return { store, act, at, tick: (minutes: number) => void (minute += minutes) };
}

const miss = (by: Author, words: string, at: string, kind?: string): FrictionEvent => frictionEvent({ type: "search-miss", words, ...(kind ? { kind } : {}) }, by, { at })!;

const records = (store: Store<AnySchema>) => store.graph.nodesOfKind("vendor" as never) as unknown as readonly LearnedRecord[];
const learn = (store: Store<AnySchema>, extra: Partial<Parameters<typeof learnFromUse>[0]> = {}) => learnFromUse({ document: wedding, log: store.log.all() as readonly Operation[], records: records(store), ...extra });
const ofKind = (suggestions: readonly AppSuggestion[], prefix: string) => suggestions.filter((one) => one.key.startsWith(prefix));

describe("aliases learned from searches that found nothing", () => {
  it("suggests an alias for the kind several people were in when the word found nothing", () => {
    const { store, at } = storeOf();
    const friction = [ada, bo, cy].map((by) => miss(by, "Supplier", at(), "vendor"));
    const [alias] = ofKind(learn(store, { friction }), "alias:");
    expect(alias).toMatchObject({ key: "alias:vendor:supplier", edits: [{ op: "add-alias", kind: "vendor", alias: "supplier" }], evidence: { people: 3, times: 3 } });
    expect(alias!.said).toMatch(/supplier/);
    expect(alias!.why).toMatch(/3 people/);
  });

  it("suggests an alias for a field when what people did next was change that field", () => {
    const { store, act, at } = storeOf();
    const friction: FrictionEvent[] = [];
    for (const [n, by] of [ada, bo, cy].entries()) {
      act(by, "add-vendor", { name: `Vendor ${n}` });
      const id = store.log.all().at(-1)!.writes[0]!;
      friction.push(miss(by, "remarks", at()));
      act(by, "edit-vendor", { id, notes: `rang them on day ${n}` });
    }
    const [alias] = ofKind(learn(store, { friction }), "alias:");
    expect(alias).toMatchObject({ key: "alias:vendor.notes:remarks", edits: [{ op: "add-alias", kind: "vendor", field: "notes", alias: "remarks" }] });
  });

  it("one person searching a word a hundred times suggests nothing", () => {
    const { store, at } = storeOf();
    const friction = Array.from({ length: 100 }, () => miss(ada, "supplier", at(), "vendor"));
    expect(ofKind(learn(store, { friction }), "alias:")).toEqual([]);
  });

  it("a word the app already says, as a name or an alias, is not suggested", () => {
    const { store, at } = storeOf();
    const friction = [ada, bo, cy].map((by) => miss(by, "vendors", at(), "vendor"));
    expect(ofKind(learn(store, { friction }), "alias:")).toEqual([]);
    const aliased = editDocument(wedding, [{ op: "add-alias", kind: "vendor", alias: "supplier" }]);
    if (!aliased.ok) throw new Error(JSON.stringify(aliased.findings));
    const again = [ada, bo, cy].map((by) => miss(by, "supplier", at(), "vendor"));
    expect(ofKind(learnFromUse({ document: aliased.document, friction: again }), "alias:")).toEqual([]);
  });

  it("a declined alias is never suggested again", () => {
    const { store, at } = storeOf();
    const friction = [ada, bo, cy, di].map((by) => miss(by, "supplier", at(), "vendor"));
    const [alias] = ofKind(learn(store, { friction }), "alias:");
    const kept = memoryLearned();
    kept.add(declineAppSuggestion(alias!, { by: ada }));
    expect(kept.list()).toMatchObject([{ key: "alias:vendor:supplier", answer: "declined", by: { kind: "human", id: "ada" } }]);
    // More people, more searches: still declined.
    const more = [...friction, ...[person("ed"), person("fy")].map((by) => miss(by, "supplier", at(), "vendor"))];
    expect(ofKind(learn(store, { friction: more, declined: kept.list() }), "alias:")).toEqual([]);
    // A key alone is a decline too, as a host keeps it.
    expect(ofKind(learn(store, { friction: more, declined: ["alias:vendor:supplier"] }), "alias:")).toEqual([]);
  });
});

describe("accepting and declining", () => {
  it("is never silent: learning changes nothing, and accepting applies its edits as one change with lineage", () => {
    const { store, at } = storeOf();
    const friction = [ada, bo, cy].map((by) => miss(by, "supplier", at(), "vendor"));
    const before = JSON.stringify(wedding);
    const [alias] = ofKind(learn(store, { friction }), "alias:");
    expect(JSON.stringify(wedding)).toBe(before);
    const accepted = acceptAppSuggestion(wedding, alias!, { by: ada, at: "2026-10-25T00:00:00.000Z" });
    if (!accepted.ok) throw new Error(JSON.stringify(accepted.findings));
    expect(accepted.document.kinds["vendor"]!.aliases).toEqual(["supplier"]);
    expect(accepted.lineage).toEqual({ basis: alias!.why, suggestion: "alias:vendor:supplier", actor: "learns from use" });
    expect(accepted.decision).toMatchObject({ key: "alias:vendor:supplier", answer: "accepted", at: "2026-10-25T00:00:00.000Z" });
    expect(accepted.said.join(" ")).toMatch(/supplier/);
    // Once accepted, the word names something, and nothing is suggested of it.
    expect(ofKind(learnFromUse({ document: accepted.document, friction }), "alias:")).toEqual([]);
  });

  it("refuses an accepted suggestion whose edits no longer apply, with the editor's findings", () => {
    const stale: AppSuggestion = { key: "alias:gone:word", edits: [{ op: "add-alias", kind: "gone", alias: "word" }], said: "", why: "x", evidence: { people: 3, times: 3 } };
    const accepted = acceptAppSuggestion(wedding, stale);
    expect(accepted.ok).toBe(false);
  });
});

describe("a choice field, from the values a text field keeps", () => {
  it("suggests retyping a text field to a choice when its values are a small set several people wrote", () => {
    const { store, act } = storeOf();
    const writers = [ada, bo, cy];
    ["flowers", "catering", "music", "flowers", "catering", "music", "flowers", "catering"].forEach((category, n) => act(writers[n % 3]!, "add-vendor", { name: `V${n}`, category }));
    const [choice] = ofKind(learn(store), "choice:");
    expect(choice).toMatchObject({ key: "choice:vendor.category", edits: [{ op: "retype-field", kind: "vendor", field: "category", type: "enum", options: ["catering", "flowers", "music"] }], evidence: { people: 3, times: 8 } });
    const accepted = acceptAppSuggestion(wedding, choice!);
    expect(accepted.ok && accepted.document.kinds["vendor"]!.fields["category"]).toMatchObject({ type: "enum", options: ["catering", "flowers", "music"] });
  });

  it("a set one person wrote is their habit, and suggests nothing", () => {
    const { store, act } = storeOf();
    ["flowers", "catering", "music", "flowers", "catering", "music", "flowers", "catering"].forEach((category, n) => act(ada, "add-vendor", { name: `V${n}`, category }));
    expect(ofKind(learn(store), "choice:")).toEqual([]);
  });

  it("values that do not repeat are words, not a choice", () => {
    const { store, act } = storeOf();
    ["a", "b", "c", "d", "e", "f", "g", "h"].forEach((category, n) => act([ada, bo, cy][n % 3]!, "add-vendor", { name: `V${n}`, category: `one of a kind ${category}` }));
    expect(ofKind(learn(store), "choice:")).toEqual([]);
  });
});

describe("a date field, from dates written into words", () => {
  it("suggests adding a date field and never moves the dates", () => {
    const { store, act } = storeOf();
    const notes = ["call back 2026-11-02", "tasting on 11/14/2026", "deposit due March 3", "meet 2026-12-01", "visit 2026-11-20", "no date here"];
    notes.forEach((text, n) => act([ada, bo, cy][n % 3]!, "add-vendor", { name: `V${n}`, notes: text }));
    const [date] = ofKind(learn(store), "date:");
    expect(date).toMatchObject({ key: "date:vendor.notes", edits: [{ op: "add-field", kind: "vendor", field: "notesDate", type: "date" }], evidence: { people: 3, times: 5 } });
    expect(date!.said).toMatch(/nothing is moved|by hand/i);
    const accepted = acceptAppSuggestion(wedding, date!);
    expect(accepted.ok && accepted.fills).toEqual([]);
  });
});

describe("one act for a sequence several people repeat", () => {
  it("suggests an act composing two acts taken one after the other on the same record", () => {
    const { store, act } = storeOf();
    for (const [n, by] of [ada, bo, cy].entries()) {
      act(by, "add-vendor", { name: `V${n}` });
      const id = store.log.all().at(-1)!.writes[0]!;
      act(by, "shortlist", { id });
      act(by, "flag-for-call", { id });
    }
    const [composed] = ofKind(learn(store), "act:");
    expect(composed).toMatchObject({
      key: "act:shortlist>flag-for-call",
      edits: [{ op: "add-act", act: "shortlist-and-flag-for-call", on: "vendor", sets: { stage: "shortlisted", callBack: true } }],
      evidence: { people: 3, times: 3 },
    });
    const accepted = acceptAppSuggestion(wedding, composed!);
    if (!accepted.ok) throw new Error(JSON.stringify(accepted.findings));
    expect(compileDocument(accepted.document).ok).toBe(true);
  });

  it("skips a sequence the act language cannot compose, and says why", () => {
    const { store, act } = storeOf();
    for (const [n, by] of [ada, bo, cy].entries()) {
      act(by, "add-vendor", { name: `V${n}` });
      const id = store.log.all().at(-1)!.writes[0]!;
      act(by, "shortlist", { id });
      act(by, "edit-vendor", { id, notes: "rang them" });
    }
    const learned = learningFrom({ document: wedding, log: store.log.all(), records: records(store) });
    expect(ofKind(learned.suggestions, "act:")).toEqual([]);
    expect(learned.skipped).toContainEqual(expect.objectContaining({ key: "act:shortlist>edit-vendor", why: expect.stringMatching(/edit-vendor/) }));
  });
});

describe("a place nobody opens", () => {
  it("suggests hiding a declared place nobody opened, from counts a host passes", () => {
    const [retire, ...rest] = ofKind(learnFromUse({ document: wedding, opens: { pipeline: 5, "old-board": 0 } }), "retire:");
    expect(rest).toEqual([]);
    expect(retire).toMatchObject({ key: "retire:old-board", edits: [{ op: "set-lens-hidden", title: "Old board", hidden: true }], evidence: { people: 0, times: 0 } });
  });

  it("says nothing when hardly anybody opens anything", () => {
    expect(ofKind(learnFromUse({ document: wedding, opens: { pipeline: 1, "old-board": 0 } }), "retire:")).toEqual([]);
  });
});

describe("an agent's tool mistakes", () => {
  const mistake = (by: Author, act: string): FrictionEvent => frictionEvent({ type: "tool-invalid", tool: act, act, message: "price must be a number", then: "{ id: string, price: number }" }, { kind: "agent", id: "claude", onBehalfOf: by }, { at: "2026-10-20T12:00:00.000Z" })!;

  it("suggests a clearer description for a document act several people's agents called wrongly", () => {
    const friction = [ada, bo, cy].map((by) => mistake(by, "book"));
    const [described] = ofKind(learnFromUse({ document: wedding, friction }), "describe-act:");
    expect(described).toMatchObject({ key: "describe-act:book", evidence: { people: 3, times: 3 } });
    expect(described!.edits).toEqual([{ op: "add-act", act: "book", replace: true, ...wedding.acts!["book"], description: "Book it. Called as { id: string, price: number }." }]);
  });

  it("says nothing of an act that is not the document's", () => {
    const friction = [ada, bo, cy].map((by) => mistake(by, "edit-vendor"));
    expect(ofKind(learnFromUse({ document: wedding, friction }), "describe-act:")).toEqual([]);
  });
});
