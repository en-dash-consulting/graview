import { describe, expect, it } from "vitest";
import { compileDocument, describeApp } from "../../src/check.js";
import { editDocument, type GraviewDocument } from "../../src/document/index.js";
import { Store, type AnySchema, type GraviewApp, type Principal } from "../../src/index.js";

/**
 * EVERY RELATION COMES WITH ITS CONNECT AND DISCONNECT (Roadmap
 * f-relation-acts-derived). After `add-relation` — a moment taken on a day,
 * a moment that features a traveler — nothing could link two records until
 * somebody also wrote an act that `connects`. A kind is given its edit,
 * remove and archive; a relation is given `connect-<kind>-<relation>` and
 * `disconnect-<kind>-<relation>` the same way: titled from the relation,
 * held to its cardinality, judged by the policy through the acts that make
 * or change the kind it leaves, and replaced by any declared act that
 * connects or severs the same relation.
 */
const trip = (): GraviewDocument =>
  ({
    format: "graview-document",
    formatVersion: 1,
    name: "Trip journal",
    kinds: {
      moment: { fields: { caption: { type: "string", required: true } } },
      day: { fields: { date: { type: "date", required: true } }, label: "{date}" },
      traveler: { fields: { name: { type: "string", required: true } } },
    },
    acts: {
      "add-moment": { title: "Add a moment", creates: "moment" },
      "add-day": { title: "Add a day", creates: "day" },
      "add-traveler": { title: "Add a traveler", creates: "traveler" },
    },
    roles: ["writer", "reader"],
    policy: {
      grants: [
        { roles: ["writer"], mutations: ["add-moment", "add-day", "add-traveler"] },
        { roles: "*", mutations: ["add-traveler"] },
      ],
    },
  }) as unknown as GraviewDocument;

const RELATIONS = [
  { op: "add-relation", kind: "moment", relation: "takenOn", to: ["day"], cardinality: "one", description: "the day it was taken", inverse: "moments that day" },
  { op: "add-relation", kind: "moment", relation: "features", to: ["traveler"], cardinality: "many", inverse: "moments featuring them" },
];

function appOf(doc: GraviewDocument): GraviewApp<AnySchema> {
  const compiled = compileDocument(doc, { today: () => "2026-10-18" });
  if (!compiled.ok) throw new Error(`the document compiles: ${JSON.stringify(compiled.findings.filter((f) => f.severity === "error"))}`);
  return compiled.app as GraviewApp<AnySchema>;
}

function edited(edits: readonly unknown[], doc: GraviewDocument = trip()): GraviewDocument {
  const outcome = editDocument(doc, edits);
  if (!outcome.ok) throw new Error(`the edit applies: ${JSON.stringify(outcome.findings)}`);
  return outcome.document;
}

const seed = {
  nodes: [
    { id: "moment:sunset", kind: "moment", caption: "Sunset at the pier" },
    { id: "day:one", kind: "day", date: "2026-10-01" },
    { id: "day:two", kind: "day", date: "2026-10-02" },
    { id: "traveler:ana", kind: "traveler", name: "Ana" },
    { id: "traveler:ben", kind: "traveler", name: "Ben" },
  ],
  edges: [],
};

const storeOf = (app: GraviewApp<AnySchema>) =>
  new Store<AnySchema>({ schema: app.schema, mutations: (app.mutations ?? []) as never, ...(app.policy ? { policy: app.policy } : {}), snapshot: structuredClone(seed) as never });
const out = (store: Store<AnySchema>, id: string, relation: string) => store.graph.out(id, relation).map((n) => n.id).sort();
const writer: Principal = { kind: "human", id: "u:wren", roles: ["writer"] };
const reader: Principal = { kind: "human", id: "u:reed", roles: ["reader"] };

describe("a relation declared without acts", () => {
  const app = appOf(edited(RELATIONS));
  const acts = (app: GraviewApp<AnySchema>) => storeOf(app).allMutations();
  const act = (name: string) => acts(app).find((one) => one.name === name);

  it("is given a connect and a disconnect, named for the kind it leaves and the relation", () => {
    const names = acts(app).map((one) => one.name);
    expect(names).toEqual(expect.arrayContaining(["connect-moment-taken-on", "disconnect-moment-taken-on", "connect-moment-features", "disconnect-moment-features"]));
    expect(act("connect-moment-features")).toMatchObject({ connects: ["features"], subject: { kinds: ["moment"], arg: "id" }, derived: { kind: "moment", act: "connect", relation: "features" } });
    expect(act("disconnect-moment-features")).toMatchObject({ severs: ["features"], destructive: true, derived: { kind: "moment", act: "disconnect", relation: "features" } });
  });

  it("is titled from the relation, its cardinality and its description, and read from the other end", () => {
    expect(act("connect-moment-taken-on")).toMatchObject({ title: "Set the day", fromTheOtherEnd: "Link a moment" });
    expect(act("connect-moment-taken-on")?.description).toContain("the day it was taken");
    expect(act("disconnect-moment-taken-on")).toMatchObject({ title: "Clear the day", fromTheOtherEnd: "Unlink a moment" });
    expect(act("connect-moment-features")).toMatchObject({ title: "Link a traveler" });
    expect(act("disconnect-moment-features")).toMatchObject({ title: "Unlink a traveler" });
  });

  it("links two records with no add-act, and holds a cardinality-one relation to one link", () => {
    const store = storeOf(app);
    const as = { author: writer };
    store.apply({ name: "connect-moment-features", args: { id: "moment:sunset", to: "traveler:ana" } }, as);
    store.apply({ name: "connect-moment-features", args: { id: "moment:sunset", to: "traveler:ben" } }, as);
    expect(out(store, "moment:sunset", "features")).toEqual(["traveler:ana", "traveler:ben"]);
    store.apply({ name: "connect-moment-taken-on", args: { id: "moment:sunset", to: "day:one" } }, as);
    const moved = store.apply({ name: "connect-moment-taken-on", args: { id: "moment:sunset", to: "day:two" } }, as);
    expect(out(store, "moment:sunset", "takenOn")).toEqual(["day:two"]);
    // One act, one undo: the day it had comes back.
    store.undo(moved.batch, as);
    expect(out(store, "moment:sunset", "takenOn")).toEqual(["day:one"]);
    store.apply({ name: "disconnect-moment-features", args: { id: "moment:sunset", to: "traveler:ana" } }, as);
    expect(out(store, "moment:sunset", "features")).toEqual(["traveler:ben"]);
  });

  it("says what it did in words, and refuses to unlink what is not linked", () => {
    const store = storeOf(app);
    const as = { author: writer };
    expect(store.apply({ name: "connect-moment-features", args: { id: "moment:sunset", to: "traveler:ana" } }, as).ops[0]?.intent).toBe("Link Sunset at the pier to Ana");
    expect(store.apply({ name: "connect-moment-taken-on", args: { id: "moment:sunset", to: "day:one" } }, as).ops[0]?.intent).toMatch(/^Set the day of Sunset at the pier to /);
    expect(() => store.apply({ name: "disconnect-moment-features", args: { id: "moment:sunset", to: "traveler:ben" } }, as)).toThrow(/Sunset at the pier is not linked to Ben/);
    expect(() => store.apply({ name: "connect-moment-features", args: { id: "moment:sunset", to: "day:one" } }, as)).toThrow();
    expect(out(store, "moment:sunset", "features")).toEqual(["traveler:ana"]);
  });

  it("is permitted to whoever may make or change the kind it leaves, and to nobody else", () => {
    const store = storeOf(app);
    expect(store.permits({ name: "connect-moment-features", args: { id: "moment:sunset", to: "traveler:ana" } }, writer).ok).toBe(true);
    expect(store.permits({ name: "connect-moment-features", args: { id: "moment:sunset", to: "traveler:ana" } }, reader).ok).toBe(false);
    expect(store.permittedMutations(reader).map((one) => one.name)).not.toContain("connect-moment-features");
  });

  it("is told to an agent describing the app", () => {
    const said = describeApp(app);
    expect(said).toContain(`Moments → day (takenOn): made by "connect-moment-taken-on", unmade by "disconnect-moment-taken-on".`);
  });

  it("is refused a record the seat may not see", () => {
    const sighted = appOf(
      edited(RELATIONS, {
        ...trip(),
        policy: { ...(trip() as unknown as { policy: object }).policy, sees: [{ roles: ["writer"], kinds: ["moment", "day"] }] },
      } as unknown as GraviewDocument),
    );
    const store = storeOf(sighted);
    expect(() => store.apply({ name: "connect-moment-features", args: { id: "moment:sunset", to: "traveler:ana" } }, { author: writer })).toThrow(/“Link a traveler” names a record/);
    // The writer may link a moment to a day it sees.
    store.apply({ name: "connect-moment-taken-on", args: { id: "moment:sunset", to: "day:one" } }, { author: writer });
    expect(out(store, "moment:sunset", "takenOn")).toEqual(["day:one"]);
    expect(out(store, "moment:sunset", "features")).toEqual([]);
  });
});

describe("a relation with acts of its own", () => {
  it("keeps a declared connect in place of the derived one, and a declared sever in place of the derived disconnect", () => {
    const doc = edited([
      ...RELATIONS,
      { op: "add-act", act: "feature", title: "Feature someone", on: "moment", connects: "features" },
      { op: "add-act", act: "unfeature", title: "Leave someone out", on: "moment", severs: "takenOn" },
      { op: "add-grant", roles: ["writer"], mutations: ["feature", "unfeature"] },
    ]);
    const names = storeOf(appOf(doc)).allMutations().map((one) => one.name);
    expect(names).not.toContain("connect-moment-features");
    expect(names).toContain("disconnect-moment-features");
    expect(names).toContain("connect-moment-taken-on");
    expect(names).not.toContain("disconnect-moment-taken-on");
  });

  it("gives an append-only relation no disconnect", () => {
    const doc = edited([{ ...RELATIONS[1], appendOnly: true }]);
    const names = storeOf(appOf(doc)).allMutations().map((one) => one.name);
    expect(names).toContain("connect-moment-features");
    expect(names).not.toContain("disconnect-moment-features");
  });

  it("gives a relation to another app's kind no connect: the derived edit sets it, as a field", () => {
    const doc = edited([{ op: "add-relation", kind: "moment", relation: "atHouse", to: ["@nick/house/house"], cardinality: "one" }]);
    const names = storeOf(appOf(doc)).allMutations().map((one) => one.name);
    expect(names.filter((name) => name.includes("at-house"))).toEqual([]);
    expect(names).toContain("edit-moment");
  });

  it("lets a grant name a derived connect, and says it in the grant's words", () => {
    const outcome = editDocument(trip(), [...RELATIONS, { op: "add-grant", roles: ["reader"], mutations: ["connect-moment-features"] }]);
    if (!outcome.ok) throw new Error(JSON.stringify(outcome.findings));
    expect(outcome.said.join(" ")).toContain(`A reader may "Link a traveler".`);
    const doc = outcome.document;
    const app = appOf(doc);
    expect(storeOf(app).permits({ name: "connect-moment-features", args: { id: "moment:sunset", to: "traveler:ana" } }, reader).ok).toBe(true);
  });

  it("keeps a grant naming one through a rename of its relation or its kind, and drops it with the relation", () => {
    const granted = [...RELATIONS, { op: "add-grant", roles: ["reader"], mutations: ["connect-moment-features", "add-traveler"] }];
    const grantsOf = (doc: GraviewDocument) => (doc as unknown as { policy: { grants: { mutations: string[] }[] } }).policy.grants.map((grant) => grant.mutations);
    const renamed = edited([...granted, { op: "rename-relation", kind: "moment", relation: "features", to: "shows" }]);
    expect(grantsOf(renamed)).toContainEqual(["connect-moment-shows", "add-traveler"]);
    const rekinded = edited([...granted, { op: "rename-kind", kind: "moment", to: "snapshot" }]);
    expect(grantsOf(rekinded)).toContainEqual(["connect-snapshot-features", "add-traveler"]);
    const dropped = edited([...granted, { op: "remove-relation", kind: "moment", relation: "features" }]);
    expect(grantsOf(dropped)).toContainEqual(["add-traveler"]);
    for (const doc of [renamed, rekinded, dropped]) appOf(doc);
  });
});
