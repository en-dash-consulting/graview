import { describe, expect, it } from "vitest";
import { compileDocument } from "../../src/check.js";
import { describeApp } from "../../src/cli/describe.js";
import { editDocument, type GraviewDocument } from "../../src/document/index.js";
import { refusalOf, Store, unwrittenFields, type AnySchema, type GraviewApp, type Principal } from "../../src/index.js";

/**
 * Roadmap f-acts-update-linked. AN ACT UPDATES THE RECORDS IT IS LINKED TO.
 * `setsOther` set fields on the far record only while `connects` made the
 * link, so a person editing a plan item could not carry the change to its
 * event. Now an act `on` a kind says `setsLinked`: fields set, in the same
 * change, on every record its subject already reaches through a relation —
 * from whichever end the declaration puts the subject on — each expression
 * read standing on the subject with `to` the far record. One change, one
 * undo; judged by each far record's own edit, and refused naming the record
 * where one is not the person's to change.
 */
const PLANS = {
  format: "graview-document",
  formatVersion: 1,
  name: "Plans",
  roles: ["planner", "helper"],
  kinds: {
    "plan-item": { fields: { name: { type: "string", required: true }, day: { type: "date" } }, edges: { event: { to: ["event"] } } },
    event: { fields: { title: { type: "string", required: true }, day: { type: "date" }, note: { type: "string" }, seats: { type: "integer" } }, computed: { words: "len(title)" } },
    person: { fields: { name: { type: "string", required: true }, note: { type: "string" } }, edges: { items: { to: ["plan-item"] } } },
  },
  acts: {
    "add-item": { creates: "plan-item" },
    "add-event": { creates: "event" },
    "add-person": { creates: "person" },
    "link-event": { on: "plan-item", connects: "event" },
    // The change a person makes to the plan item is carried to each of its events.
    "rename-item": { title: "Rename the item", on: "plan-item", writes: ["name"], setsLinked: { event: { title: { expr: "name" } } } },
    // An argument, a literal and an expression that reads the far record as `to`.
    "move-item": { on: "plan-item", writes: ["day"], setsLinked: { event: { day: "$day", note: { expr: "concat('moved with ', name, ' for ', to.title)" } } } },
    // Through a relation declared on the far kind, pointing at the subject.
    "claim-item": { on: "plan-item", setsLinked: { items: { note: { expr: "concat('holds ', name)" } } } },
  },
  policy: {
    grants: [
      { roles: ["planner"], mutations: "*" },
      { roles: ["helper"], mutations: ["rename-item", "add-item"] },
    ],
  },
};

const SEED = {
  nodes: [
    { id: "i1", kind: "plan-item", name: "Picnic", day: "2026-10-27" },
    { id: "i2", kind: "plan-item", name: "Lonely" },
    { id: "ev1", kind: "event", title: "Old title" },
    { id: "ev2", kind: "event", title: "Older" },
    { id: "p1", kind: "person", name: "Ann" },
  ],
  edges: [
    { kind: "event", from: "i1", to: "ev1" },
    { kind: "event", from: "i1", to: "ev2" },
    { kind: "items", from: "p1", to: "i1" },
  ],
};

function compiled(doc: unknown = PLANS): GraviewApp<AnySchema> {
  const result = compileDocument(doc, { today: () => "2026-10-27" });
  if (!result.ok) throw new Error(`the document compiles: ${JSON.stringify(result.findings.filter((f) => f.severity === "error"))}`);
  return result.app as GraviewApp<AnySchema>;
}
const storeOf = (app: GraviewApp<AnySchema>, policy = false) =>
  new Store<AnySchema>({ schema: app.schema, mutations: app.mutations ?? [], ...(policy && app.policy ? { policy: app.policy } : {}), snapshot: structuredClone(SEED) as never });
const refused = (run: () => unknown): unknown => {
  try {
    run();
  } catch (error) {
    return error;
  }
  throw new Error("expected a refusal");
};
const planner: Principal = { kind: "human", id: "pat", roles: ["planner"] };
const helper: Principal = { kind: "human", id: "hal", roles: ["helper"] };

describe("the declaration", () => {
  const app = compiled();

  it("compiles with no error, and the act says what it carries by relation, beside what it writes on its subject", () => {
    expect(compileDocument(PLANS).findings.filter((f) => f.severity === "error")).toEqual([]);
    const rename = app.mutations!.find((m) => m.name === "rename-item")!;
    expect(rename).toMatchObject({ writes: ["name"], writesLinked: { event: ["title"] } });
    expect(rename.writesOther).toBeUndefined();
  });

  it("asks for an argument once, whether the subject's field or the carried value names it, and never for `$to`", () => {
    const move = app.mutations!.find((m) => m.name === "move-item")!;
    expect(Object.keys((move.input as unknown as { shape: Record<string, unknown> }).shape).sort()).toEqual(["day", "id"]);
  });

  it("leaves the far kind's own edit offering the field: the act carries a value to it, which is not a named step", () => {
    expect(unwrittenFields(app.schema, app.mutations ?? [], "event")).toEqual(["title", "day", "note", "seats"]);
  });

  it("is said by describe as what the act also changes", () => {
    const said = describeApp(app);
    expect(said).toContain("## Carried across links");
    expect(said).toContain('"rename-item" also sets title on every record linked to plan items through event, in the same change; it is refused, naming the record, where one of them is not the person\'s to change.');
  });
});

describe("applied", () => {
  it("sets the field on every record the subject reaches, in the same change, and one undo takes all of it back", () => {
    const store = storeOf(compiled());
    const before = store.graph.snapshot();
    const { batch } = store.apply({ name: "rename-item", args: { id: "i1", name: "Picnic in the park" } });
    expect(store.graph.getNode("i1")).toMatchObject({ name: "Picnic in the park" });
    expect(store.graph.getNode("ev1")).toMatchObject({ title: "Picnic in the park" });
    expect(store.graph.getNode("ev2")).toMatchObject({ title: "Picnic in the park" });
    store.undo(batch);
    expect(store.graph.snapshot()).toEqual(before);
  });

  it("takes an argument, a literal and an expression that reads the subject with the far record as `to`", () => {
    const store = storeOf(compiled());
    store.apply({ name: "move-item", args: { id: "i1", day: "2026-11-02" } });
    expect(store.graph.getNode("ev1")).toMatchObject({ day: "2026-11-02", note: "moved with Picnic for Old title" });
    expect(store.graph.getNode("ev2")).toMatchObject({ day: "2026-11-02", note: "moved with Picnic for Older" });
  });

  it("walks a relation declared on the far kind, pointing at the subject", () => {
    const store = storeOf(compiled());
    store.apply({ name: "claim-item", args: { id: "i1" } });
    expect(store.graph.getNode("p1")).toMatchObject({ note: "holds Picnic" });
  });

  it("changes only the subject when nothing is linked to it", () => {
    const store = storeOf(compiled());
    const before = store.graph.snapshot();
    store.apply({ name: "rename-item", args: { id: "i2", name: "Still lonely" } });
    expect(store.graph.getNode("i2")).toMatchObject({ name: "Still lonely" });
    expect(store.graph.getNode("ev1")).toEqual(before.nodes.find((n) => n.id === "ev1"));
  });
});

describe("judged by each far record's own grants", () => {
  it("a person who may rename the item but may not change its events is refused, and the refusal names the event", () => {
    const store = storeOf(compiled(), true);
    const verdict = store.permits({ name: "rename-item", args: { id: "i1" } }, helper);
    expect(verdict.ok).toBe(false);
    if (verdict.ok) return;
    expect(verdict.refusal.message).toMatch(/“Rename the item” would change “Old title”, an event that is not yours to change/);
    const error = refused(() => store.apply({ name: "rename-item", args: { id: "i1", name: "Taken" } }, { author: helper }));
    expect(refusalOf(error).sentence).toMatch(/would change “Old title”/);
    expect(store.graph.getNode("ev1")).toMatchObject({ title: "Old title" });
    expect(store.graph.getNode("i1")).toMatchObject({ name: "Picnic" });
  });

  it("the same person renames an item nothing is linked to, and a planner renames anything", () => {
    const store = storeOf(compiled(), true);
    expect(store.permits({ name: "rename-item", args: { id: "i2" } }, helper).ok).toBe(true);
    store.apply({ name: "rename-item", args: { id: "i2", name: "Mine" } }, { author: helper });
    expect(store.graph.getNode("i2")).toMatchObject({ name: "Mine" });
    expect(store.permits({ name: "rename-item", args: { id: "i1" } }, planner).ok).toBe(true);
    store.apply({ name: "rename-item", args: { id: "i1", name: "Theirs" } }, { author: planner });
    expect(store.graph.getNode("ev2")).toMatchObject({ title: "Theirs" });
  });

  it("the check warns when a role that may run the act cannot see the records it reaches", () => {
    const sighted = { ...PLANS, policy: { ...PLANS.policy, sees: [{ roles: ["planner"], kinds: ["plan-item", "event", "person"] }, { roles: ["helper"], kinds: ["plan-item"] }] } };
    const findings = compileDocument(sighted).findings.filter((f) => f.code === "check:act-reads-hidden-kind" && f.path === "acts.rename-item");
    expect(findings.map((f) => f.message)).toEqual([expect.stringMatching(/"rename-item" reads event records \(the linked records it changes\), which "helper" may run it but may not see/)]);
  });
});

describe("the checker", () => {
  const withAct = (act: Record<string, unknown>) => compileDocument({ ...PLANS, acts: { ...PLANS.acts, odd: act } }).findings.filter((f) => f.severity === "error").map((f) => [f.code, f.path, f.message, f.fix]);

  it("refuses a relation that joins the subject's kind to nothing, naming the relations it has", () => {
    expect(withAct({ on: "plan-item", setsLinked: { nothing: { title: "x" } } })).toEqual([
      ["act-sets-linked-relation", "acts.odd.setsLinked.nothing", '"nothing" is not a relation that joins a plan item to anything, so "odd" has no linked records to set through it', "name one of plan-item's relations: event"],
    ]);
  });

  it("refuses an act on no kind", () => {
    expect(withAct({ setsLinked: { event: { title: "x" } } }).filter(([code]) => code !== "act-empty")).toEqual([
      ["act-sets-linked-relation", "acts.odd.setsLinked", '"odd" sets the records linked to its subject, and is on no kind', 'say which kind it is "on"; the relations it carries values through are that kind\'s'],
    ]);
  });

  it("refuses a field the far kind has not, a value it could not hold, and a computed field", () => {
    expect(withAct({ on: "plan-item", setsLinked: { event: { color: "red" } } })).toEqual([
      ["act-sets-linked-field", "acts.odd.setsLinked.event.color", 'event, at the far end of "event", has no field "color"', "set one of event's fields: title, day, note, seats"],
    ]);
    expect(withAct({ on: "plan-item", setsLinked: { event: { seats: "many" } } })).toEqual([
      ["act-sets-linked-field", "acts.odd.setsLinked.event.seats", 'event\'s seats holds an integer, and "many" is not one', 'write an integer, an argument ("$name") or an expression ({ "expr": … })'],
    ]);
    expect(withAct({ on: "plan-item", setsLinked: { event: { words: "x" } } }).map(([code]) => code)).toEqual(["computed-written"]);
  });

  it("types a carried expression standing on the subject", () => {
    expect(withAct({ on: "plan-item", setsLinked: { event: { title: { expr: "format(name, 'EEE')" } } } })).toEqual([
      ["expr-type", "acts.odd.setsLinked.event", 'format(…) needs a date, and "name" is words', expect.any(String)],
    ]);
  });
});

describe("edited", () => {
  const doc = PLANS as unknown as GraviewDocument;
  const acts = (edited: ReturnType<typeof editDocument>) => {
    expect(edited.ok, JSON.stringify(edited)).toBe(true);
    return (edited as { document: GraviewDocument }).document.acts!;
  };

  it("follows a renamed field of the far kind", () => {
    expect(acts(editDocument(doc, [{ op: "rename-field", kind: "event", field: "title", to: "heading" }]))["rename-item"]!.setsLinked).toEqual({ event: { heading: { expr: "name" } } });
  });

  it("follows a renamed relation", () => {
    expect(acts(editDocument(doc, [{ op: "rename-relation", kind: "plan-item", relation: "event", to: "events" }]))["rename-item"]!.setsLinked).toEqual({ events: { title: { expr: "name" } } });
  });

  it("drops the entry with its relation, and an act that did nothing else", () => {
    const after = acts(editDocument(doc, [{ op: "remove-relation", kind: "plan-item", relation: "event" }, { op: "remove-relation", kind: "person", relation: "items" }]));
    expect(after["rename-item"]).toEqual({ title: "Rename the item", on: "plan-item", writes: ["name"] });
    expect(after["claim-item"]).toBeUndefined();
  });

  it("drops the entry with the far field it carried", () => {
    const after = acts(editDocument(doc, [{ op: "remove-field", kind: "event", field: "title" }]));
    expect(after["rename-item"]!.setsLinked).toBeUndefined();
    expect(after["rename-item"]!.writes).toEqual(["name"]);
  });
});
