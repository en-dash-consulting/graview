import { describe, expect, it } from "vitest";
import { z } from "zod";
import { attachFriction, createSchema, defineNode, recordFriction, Store, type Author } from "../../src/index.js";
import {
  callShape,
  FRICTION_LIMITS,
  frictionDigest,
  frictionEvent,
  frictionOf,
  frictionSinkTo,
  memoryFriction,
  ownFriction,
  toolMistakes,
  withinRetention,
  type FrictionEvent,
} from "../../src/friction.js";
import { aiContextOf } from "../../src/catalog.js";

const vendor = defineNode("vendor", { fields: z.object({ label: z.string(), status: z.enum(["asked", "booked"]), due: z.string().optional() }) });
const schema = createSchema([vendor]);

const ada: Author = { kind: "human", id: "ada", name: "Ada" };
const bo: Author = { kind: "human", id: "bo" };
const cy: Author = { kind: "human", id: "cy" };
const visitor: Author = { kind: "visitor", id: "visitor:rsvp:1" };
const claudeForAda: Author = { kind: "agent", id: "claude", onBehalfOf: ada };

const at = (days: number) => new Date(Date.UTC(2026, 9, 24) - days * 86_400_000).toISOString();
const ev = (by: Author, draft: Parameters<typeof frictionEvent>[0], days = 0): FrictionEvent => frictionEvent(draft, by, { at: at(days) })!;

describe("the friction log", () => {
  it("records a search that found nothing in the graph's own words: the words and the kind, by whom and when", () => {
    const event = frictionEvent({ type: "search-miss", words: "  invoice  ", kind: "vendor" }, ada, { at: at(0) })!;
    expect(event).toMatchObject({ type: "search-miss", words: "invoice", kind: "vendor", by: { kind: "human", id: "ada" }, at: at(0) });
    expect(typeof event.id).toBe("string");
  });

  it("never records a visitor, nor an agent acting for one", () => {
    expect(frictionEvent({ type: "search-miss", words: "parking" }, visitor)).toBeUndefined();
    expect(frictionEvent({ type: "unanswered", question: "where do I park?" }, { kind: "agent", id: "a", onBehalfOf: visitor })).toBeUndefined();
    const kept = memoryFriction();
    const store = new Store({ schema });
    attachFriction(store, frictionSinkTo(kept));
    recordFriction(store, { type: "search-miss", words: "parking" }, visitor);
    expect(kept.list()).toEqual([]);
  });

  it("bounds free text and treats it as data: capped, control characters gone, names that are not names refused", () => {
    const long = frictionEvent({ type: "unanswered", question: `${"why ".repeat(400)}\u0000\u001b[31m` }, ada)!;
    expect(long.type === "unanswered" && long.question.length).toBeLessThanOrEqual(FRICTION_LIMITS.question);
    expect(long.type === "unanswered" && /[\u0000-\u001f]/.test(long.question)).toBe(false);
    expect(frictionEvent({ type: "refused", act: "finish; drop table", code: "forbidden" }, ada)).toBeUndefined();
    expect(frictionEvent({ type: "refused", act: "finish", code: "not-a-code" as never }, ada)).toBeUndefined();
    expect(frictionEvent({ type: "search-miss", words: "   " }, ada)).toBeUndefined();
    expect(frictionEvent({ type: "clicked" } as never, ada)).toBeUndefined();
  });

  it("goes through one function a host can turn off: no sink, or a sink taken away, records nothing", () => {
    const kept = memoryFriction();
    const store = new Store({ schema });
    recordFriction(store, { type: "search-miss", words: "invoice" }, ada);
    attachFriction(store, frictionSinkTo(kept));
    recordFriction(store, { type: "search-miss", words: "invoice" }, ada);
    // A seat's view of the store records to the store's sink.
    recordFriction(store.seenBy({ kind: "human", id: "bo" }), { type: "search-miss", words: "receipt" }, bo);
    attachFriction(store, false);
    recordFriction(store, { type: "search-miss", words: "invoice" }, ada);
    expect(kept.list().map((event) => event.type === "search-miss" && event.words)).toEqual(["invoice", "receipt"]);
  });

  it("counts across distinct people and never says who: one person searching ten times is one person", () => {
    const events = [
      ...Array.from({ length: 10 }, () => ev(ada, { type: "search-miss", words: "Invoice" })),
      ev(bo, { type: "search-miss", words: "invoice " }),
      ev(cy, { type: "search-miss", words: "my secret thing" }),
      ev(claudeForAda, { type: "search-miss", words: "invoice" }),
    ];
    const summary = frictionOf(events, { minPeople: 2 });
    expect(summary.people).toBe(3);
    expect(summary.searches).toEqual([{ words: "invoice", people: 2, times: 12 }]);
    // Words only one person used are not said at all.
    expect(JSON.stringify(summary)).not.toContain("secret");
    expect(JSON.stringify(summary)).not.toContain("ada");
    expect(summary.byType["search-miss"]).toEqual({ events: 13, people: 3 });
  });

  it("gives a person their own events and nobody else's, an agent's for them among them", () => {
    const events = [ev(ada, { type: "search-miss", words: "invoice" }), ev(bo, { type: "search-miss", words: "receipt" }), ev(claudeForAda, { type: "unanswered", question: "who is booked?" })];
    expect(ownFriction(events, { kind: "human", id: "ada" }).map((event) => event.type)).toEqual(["search-miss", "unanswered"]);
    expect(ownFriction(events, { kind: "human" })).toEqual([]);
  });

  it("keeps what is within the retention and lets the rest go", () => {
    const events = [ev(ada, { type: "search-miss", words: "old" }, 100), ev(ada, { type: "search-miss", words: "new" }, 2)];
    expect(withinRetention(events, 30, Date.parse(at(0))).map((event) => event.type === "search-miss" && event.words)).toEqual(["new"]);
  });

  it("tells a model, in words, what people searched for that no kind or field is called, the questions left unanswered, and the tool form that worked", () => {
    const events = [
      ev(ada, { type: "search-miss", words: "invoice" }),
      ev(bo, { type: "search-miss", words: "Invoice" }),
      ev(ada, { type: "search-miss", words: "booked vendors" }),
      ev(bo, { type: "search-miss", words: "booked vendors" }),
      ev(ada, { type: "unanswered", question: "Who is still unbooked?" }),
      ev(cy, { type: "unanswered", question: "who is still unbooked" }),
      ev(claudeForAda, { type: "tool-invalid", tool: "add_vendor", act: "add-vendor", message: 'Expected "status" to be one of asked, booked.', then: callShape({ label: "Hall", status: "asked" }) }),
    ];
    const digest = frictionDigest(events, schema, { minPeople: 2 });
    // "booked vendors" names a field's value and a kind: not a gap in the app's words.
    expect(digest.unknownWords).toEqual([{ words: "invoice", people: 2 }]);
    expect(digest.questions).toEqual([{ question: "who is still unbooked", people: 2 }]);
    expect(digest.toolMistakes).toEqual([{ tool: "add_vendor", act: "add-vendor", then: "{ label: string, status: string }", times: 1 }]);
    expect(digest.said).toContain("invoice");
    expect(digest.said).toContain("who is still unbooked");
    expect(digest.said).toContain("add_vendor");
    // The refusal's sentence stays with its author: a chat is told the form, not what was typed.
    expect(digest.said).not.toContain("Expected");
  });

  it("records a tool call refused as invalid, and the next call of that tool that worked as its then", () => {
    const kept: FrictionEvent[] = [];
    const watch = toolMistakes((draft) => kept.push(frictionEvent(draft, claudeForAda)!));
    watch.heard("add_vendor", "add-vendor", { label: "Hall" }, { ok: false, reason: "invalid", message: "Say a status." });
    watch.heard("get_node", undefined, { id: "v1" }, { ok: true });
    expect(kept).toEqual([]);
    watch.heard("add_vendor", "add-vendor", { label: "Hall", status: "asked" }, { ok: true });
    expect(kept).toMatchObject([{ type: "tool-invalid", tool: "add_vendor", act: "add-vendor", message: "Say a status.", then: "{ label: string, status: string }" }]);
    // A refusal for another reason is not a mistake in the call's form; one left without a success is kept as it was.
    watch.heard("add_vendor", "add-vendor", {}, { ok: false, reason: "forbidden", message: "No." });
    watch.heard("add_vendor", "add-vendor", {}, { ok: false, reason: "invalid", message: "Say a label." });
    watch.flush();
    expect(kept).toHaveLength(2);
    expect(kept[1]).not.toHaveProperty("then");
  });

  it("hands a model the digest beside the state when the host passes events, and reads no storage of its own", () => {
    const store = new Store({ schema });
    const without = aiContextOf(store, { on: "place", place: "home" }, { principal: ada });
    expect(without).not.toHaveProperty("friction");
    const events = [ev(ada, { type: "search-miss", words: "invoice" }), ev(bo, { type: "search-miss", words: "invoice" }), ev(cy, { type: "search-miss", words: "invoice" })];
    const withIt = aiContextOf(store, { on: "place", place: "home" }, { principal: ada, friction: events });
    expect(withIt.friction?.unknownWords).toEqual([{ words: "invoice", people: 2 }]);
  });

  it("never lets a reader's own words confirm what one other person typed: the reader's events are left out of their counts", () => {
    // Bo asked once; Ada guesses his words and posts them herself.
    const events = [
      ev(bo, { type: "unanswered", question: "Who approved the merger codename zebra?" }),
      ev(ada, { type: "search-miss", words: "giraffe zebra" }),
      ev(ada, { type: "unanswered", question: "who approved the merger codename zebra" }),
      ev(claudeForAda, { type: "search-miss", words: "zebra" }),
    ];
    const toAda = frictionOf(events, { minPeople: 2, reader: { kind: "human", id: "ada" } });
    expect(toAda.questions).toEqual([]);
    expect(toAda.words).toEqual([]);
    expect(JSON.stringify(toAda)).not.toContain("zebra");
    // An agent reading for Ada is Ada: it is told no more than she is.
    expect(frictionOf(events, { minPeople: 2, reader: { kind: "agent", id: "claude", onBehalfOf: { kind: "human", id: "ada" } } }).words).toEqual([]);
    // Nor is a model reading beside her.
    const store = new Store({ schema });
    expect(aiContextOf(store, { on: "place", place: "home" }, { principal: ada, friction: events }).friction?.questions).toEqual([]);
    // Two people other than the reader are still counted.
    const toCy = frictionOf([...events, ev(cy, { type: "search-miss", words: "zebra" })], { minPeople: 2, reader: { kind: "human", id: "cy" } });
    expect(toCy.words.find((one) => one.word === "zebra")).toMatchObject({ people: 2 });
  });
});
