import { afterEach, describe, expect, it, vi } from "vitest";
import { createSchema, defineNode, markdownField, Store, TYPE_TEXT, z, type AnySchema, type Principal, type Subscription, type SubscriptionMatch } from "../../src/index.js";
import "../../src/typing.js";
import { historyInWords, ticksOf } from "../../src/history.js";
import { pastOf } from "../../src/past.js";
import { foldDigests, typedRowWords } from "../../src/tidying.js";
import { holdTypingRuns, matchSubscriptions, watchSubscriptions } from "../../src/subscriptions.js";
import { memorySubscriptions } from "../../src/index.js";

/**
 * COLLABORATIVE TEXT, PHASE 5: TYPING SAID IN WORDS (Roadmap f-collab-text).
 *
 * A person writing a paragraph is dozens of runs of typing, each a batch.
 * History, Activity, an agent's history answer and a notification say them
 * as one thing — "Ada wrote in Kitchen's notes (+42 −3)" — and what a run
 * put in and took out, never the field's whole text before and after.
 */
const room = defineNode("room", { fields: z.object({ label: z.string(), notes: markdownField().optional() }), display: { labels: { notes: "Notes" } } });
const schema = createSchema([room]) as unknown as AnySchema;
const ada: Principal = { kind: "human", id: "ada", name: "Ada" };
const bo: Principal = { kind: "human", id: "bo", name: "Bo" };

function store(notes = "Paint the walls") {
  return new Store<AnySchema>({ schema, mutations: [], snapshot: { nodes: [{ id: "kitchen", kind: "room", label: "Kitchen", notes }], edges: [] } as never });
}
const type = (s: Store<AnySchema>, author: Principal, at: number, insert: string, remove = 0) =>
  s.apply({ name: TYPE_TEXT, args: { node: "kitchen", field: "notes", at, remove, insert } }, { author });
const notes = (s: Store<AnySchema>) => (s.graph.getNode("kitchen") as { notes?: string }).notes;

describe("typing said in words", () => {
  afterEach(() => vi.useRealTimers());

  it("says one keystroke run as what it wrote, where, and how much", () => {
    const s = store();
    const made = type(s, ada, 0, "Now: ", 0);
    expect(made.ops[0]!.intent).toBe("Wrote in Kitchen's notes (+5)");
    const out = type(s, ada, 5, "Sand", 5);
    expect(out.ops[0]!.intent).toBe("Wrote in Kitchen's notes (+4 −5)");
  });

  it("groups one person's consecutive runs into one field as one tick, and breaks the run where somebody else typed", () => {
    const s = store();
    type(s, ada, 15, " white");
    type(s, ada, 21, " today");
    type(s, ada, 0, "", 6);
    type(s, bo, 0, "Then ");
    type(s, ada, notes(s)!.length, "!");
    const ticks = ticksOf(s, { me: ada }).filter((tick) => tick.batch !== undefined);
    expect(ticks.map((tick) => tick.said)).toEqual(["Wrote in Notes (+12 −6)", "Wrote in Notes (+5)", "Wrote in Notes (+1)"]);
    expect(ticks[0]!.batches).toHaveLength(3);
    expect(ticks[0]!.seq).toBe(3);
    expect(ticks.map((tick) => tick.maker)).toEqual(["you", "person", "you"]);
    // What it typed is said as spans, keystrokes that touch made one: never the field's text whole.
    expect(historyInWords(s).at(-1)!.typed!.spans).toEqual([
      { at: 15, removed: "", inserted: " white today" },
      { at: 0, removed: "Paint ", inserted: "" },
    ]);
  });

  it("answers an agent's history in sentences, newest first, a run of typing as one", () => {
    const s = store();
    type(s, ada, 15, " white");
    type(s, ada, 21, " now");
    type(s, bo, 0, "Then ");
    const said = historyInWords(s, { context: { seats: [] } });
    expect(said.map((one) => one.sentence)).toEqual(["Bo wrote in Kitchen's notes (+5)", "Ada wrote in Kitchen's notes (+10)"]);
    expect(said[1]!.batches).toHaveLength(2);
    expect(JSON.stringify(said)).not.toContain("Paint the walls");
  });

  it("folds as now: the app as it stood partway through a run holds the text typed so far", () => {
    const s = store();
    type(s, ada, 15, " white");
    type(s, ada, 21, " now");
    expect((pastOf(s, 1).graph.getNode("kitchen") as unknown as { notes: string }).notes).toBe("Paint the walls white");
    expect(notes(s)).toBe("Paint the walls white now");
  });

  it("tells a subscriber what was put in and taken out, not the text twice", () => {
    const s = store("x".repeat(4000));
    const subscription: Subscription = { id: "s1", app: "rooms", who: bo, when: { on: "changed", kind: "room" }, at: "2026-10-23T00:00:00.000Z" };
    const made = type(s, ada, 10, "hello", 2);
    const [match] = matchSubscriptions(s, made.ops, [subscription]);
    expect(match!.said).toBe("Ada wrote in Kitchen's notes (+5 −2)");
    const field = match!.records[0]!.fields![0]!;
    expect(field).toEqual({ field: "notes", words: "Notes", typed: { inserted: 5, removed: 2, spans: [{ at: 10, removed: "xx", inserted: "hello" }] } });
    expect(JSON.stringify(match)).not.toContain("x".repeat(100));
  });

  it("tells a run of typing once, when the typist stops, and anything else at once and after it", async () => {
    vi.useFakeTimers();
    const s = store();
    const subscriptions = memorySubscriptions([{ id: "s1", app: "rooms", who: { kind: "human", id: "cy" }, when: { on: "changed", kind: "room" }, at: "2026-10-23T00:00:00.000Z" }] as never);
    const told: SubscriptionMatch[] = [];
    const stop = watchSubscriptions(s, { subscriptions, onSubscriptionMatch: (match) => void told.push(match), typingQuietMs: 1000 });
    type(s, ada, 15, " white");
    vi.advanceTimersByTime(600);
    type(s, ada, 21, " now");
    vi.advanceTimersByTime(600);
    expect(told).toHaveLength(0);
    vi.advanceTimersByTime(500);
    expect(told.map((match) => match.said)).toEqual(["Ada wrote in Kitchen's notes (+10)"]);
    expect(told[0]!.batches).toHaveLength(2);
    expect(told[0]!.records[0]!.fields![0]!.typed).toEqual({ inserted: 10, removed: 0, spans: [{ at: 15, removed: "", inserted: " white now" }] });
    // Bo's typing is his own run, told once another match for the subscription comes; stopping tells what is held.
    type(s, bo, 0, "Then ");
    expect(told).toHaveLength(1);
    s.apply({ name: TYPE_TEXT, args: { node: "kitchen", field: "notes", at: 0, remove: 0, insert: "!" } }, { author: ada });
    expect(told).toHaveLength(2);
    stop();
    expect(told.map((match) => match.said)).toEqual(["Ada wrote in Kitchen's notes (+10)", "Bo wrote in Kitchen's notes (+5)", "Ada wrote in Kitchen's notes (+1)"]);
  });

  it("holds nothing when told to wait no time", () => {
    const told: string[] = [];
    const held = holdTypingRuns((match) => void told.push(match.said), { quietMs: 0 });
    const s = store();
    const subscription: Subscription = { id: "s1", app: "rooms", who: bo, when: { on: "changed", kind: "room" }, at: "2026-10-23T00:00:00.000Z" };
    for (const match of matchSubscriptions(s, type(s, ada, 0, "A").ops, [subscription])) held.tell(match);
    expect(told).toEqual(["Ada wrote in Kitchen's notes (+1)"]);
  });
});

describe("a run of typing in Activity", () => {
  it("is one row by one person into one field, said as one", () => {
    const s = store();
    type(s, ada, 15, " white");
    type(s, ada, 21, " now");
    type(s, bo, 0, "Then ");
    const rows = foldDigests(s.batches());
    expect(rows).toHaveLength(2);
    const first = rows[0]!;
    expect("batch" in first && first.typed?.batches).toHaveLength(2);
    expect("batch" in first && first.typed ? typedRowWords(first.typed, s.schema, s.graph) : "").toBe("Wrote in Notes (+10)");
  });
});
