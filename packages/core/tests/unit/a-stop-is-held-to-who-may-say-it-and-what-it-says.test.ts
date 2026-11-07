import { describe, expect, it } from "vitest";
import { bindSchema, createSchema, defineNode, nodeRef, Store, z, type Author, type Policy, type Principal } from "../../src/index.js";
import { declined, declineSuggestion, isTidyingActor, mayStopSuggesting, stoppedSuggestions, stopSuggesting, suggest, suggestions } from "../../src/tidying.js";

/**
 * WHAT A STOP MAY SAY, WHO MAY SAY IT, AND WHAT IS LEFT OF IT AFTER A
 * CHECKPOINT (Roadmap f-inbox-needs-you-first; the review of #537).
 */
const task = defineNode("task", { fields: z.object({ label: z.string(), note: z.string().optional(), owner: z.string().optional() }), plural: "Tasks", label: (node) => node.label });
const secret = defineNode("secret", { fields: z.object({ label: z.string() }), plural: "Secrets", label: (node) => node.label });
const schema = createSchema([task, secret]);
const { defineMutation } = bindSchema(schema);
const finish = defineMutation("finish", { title: "Finish it", subject: { kinds: ["task"], arg: "id" }, writes: ["owner"], input: z.object({ id: nodeRef(["task"]) }), apply(ctx, args) { ctx.patchNode(args.id, { owner: "done" }); } });
const actor: Author = { kind: "system", id: "tidying", name: "Graview, tidying", automated: true, tidying: true };
const keeper: Principal = { kind: "human", id: "kay", name: "Kay", roles: ["keeper"] };
const reader: Principal = { kind: "human", id: "rae", name: "Rae", roles: ["reader"] };
// Whose own record is the task "one", and who may edit it and no other (a grant's `self`).
const member: Principal = { kind: "human", id: "one", name: "Mo", roles: ["member"] };
const lineage = { basis: "It reads better", confidence: 0.8 };
const NODES = [
  { id: "one", kind: "task", label: "One", owner: "mo" },
  { id: "two", kind: "task", label: "Two", owner: "kay" },
  { id: "three", kind: "task", label: "Three", owner: "kay" },
  { id: "plan", kind: "secret", label: "Layoff list for March" },
];
const POLICY: Policy = { roles: ["keeper", "reader", "member"], grants: [{ roles: ["keeper"], mutations: "*" }, { roles: ["member"], mutations: ["edit-task"], kinds: ["task"], self: true }], sees: [{ roles: ["keeper"], kinds: ["task", "secret"] }, { roles: ["reader", "member"], kinds: ["task"] }] };
const storeOf = (policy?: Policy) => new Store({ schema, mutations: [finish], snapshot: { nodes: NODES, edges: [] } as never, ...(policy ? { policy } : {}) });
const editNote = (id: string, note = "typo in note") => ({ name: "edit-task", args: { id, note } });
const editLabel = (id: string) => ({ name: "edit-task", args: { id, label: "Renamed" } });
const renameSecret = { name: "edit-secret", args: { id: "plan", label: "Layoff list for March, final" } };

describe("what a stop says", () => {
  it("names the kind of thing and no record, so a person knows what they stop", () => {
    const store = storeOf();
    stopSuggesting(store, suggest(store, [editNote("one")], { author: actor, lineage })!.id);
    expect(stoppedSuggestions(store)[0]!.words).toBe("Stopped suggesting changes to the note of tasks");
    expect(JSON.stringify(stoppedSuggestions(store))).not.toMatch(/One|typo/);
  });

  it("of an edit, stops that field and not every field of the kind", () => {
    const store = storeOf();
    stopSuggesting(store, suggest(store, [editNote("one")], { author: actor, lineage })!.id);
    expect(() => suggest(store, [editNote("two", "another note")], { author: actor, lineage })).toThrow(/this kind of thing/);
    expect(suggest(store, [editLabel("two")], { author: actor, lineage })).toBeDefined();
  });

  it("hides a suggestion of several calls only when all of them are stopped", () => {
    const store = storeOf();
    stopSuggesting(store, suggest(store, [editNote("one")], { author: actor, lineage })!.id);
    const mixed = suggest(store, [editNote("two", "other"), editLabel("three")], { author: actor, lineage })!;
    expect(suggestions(store).map((one) => one.id)).toEqual([mixed.id]);
  });
});

describe("a suggestion taken back, as a seat that may not see what it named reads the log", () => {
  it("withholds a stop's undo of a suggestion on a hidden record", () => {
    const store = storeOf(POLICY);
    stopSuggesting(store, suggest(store, [renameSecret], { author: actor, lineage })!.id, { author: keeper });
    const seen = store.seenBy(reader);
    expect(JSON.stringify(seen.log.all())).not.toContain("Layoff");
    expect(JSON.stringify(seen.batches())).not.toContain("Layoff");
    expect(stoppedSuggestions(seen)).toEqual([]);
  });

  it("withholds an ordinary decline of one too", () => {
    const store = storeOf(POLICY);
    declineSuggestion(store, suggest(store, [renameSecret], { author: actor, lineage })!.id, { author: keeper });
    const all = store.seenBy(reader).log.all();
    expect(JSON.stringify(all)).not.toContain("Layoff");
    expect(all.at(-1)!.withheld).toBe(true);
  });

  it("withholds an undo that arrives after the seat was first served the log", () => {
    const store = storeOf(POLICY);
    const made = suggest(store, [renameSecret], { author: actor, lineage })!;
    const seen = store.seenBy(reader);
    expect(seen.log.all().at(-1)!.withheld).toBe(true);
    declineSuggestion(store, made.id, { author: keeper });
    expect(JSON.stringify(seen.log.all())).not.toContain("Layoff");
  });
});

describe("who may stop a kind, and who may lift it", () => {
  it("refuses a stop said straight to the store by a seat that may not decide", () => {
    const store = storeOf(POLICY);
    const made = suggest(store, [editNote("one")], { author: actor, lineage })!;
    expect(() => store.undo(made.batch, { author: reader, lineage: { basis: "Stop it", stopsKind: true } })).toThrow(/Not permitted|may decide/);
    expect(suggestions(store)).toHaveLength(1);
  });

  it("refuses stopsKind on an undo of anything but a suggestion", () => {
    const store = storeOf();
    const made = store.apply({ name: "finish", args: { id: "one" } }, { author: keeper });
    expect(() => store.undo(made.batch, { author: keeper, lineage: { basis: "Stop it", stopsKind: true } })).toThrow(/suggestion/);
  });

  it("refuses lifting a stop to a seat that may not decide, and says so through mayUndo", () => {
    const store = storeOf(POLICY);
    const stopped = stopSuggesting(store, suggest(store, [editNote("one")], { author: actor, lineage })!.id, { author: keeper });
    expect(store.mayUndo(stopped.batch, reader).ok).toBe(false);
    expect(() => store.undo(stopped.batch, { author: reader })).toThrow();
    expect(store.mayUndo(stopped.batch, keeper).ok).toBe(true);
    store.undo(stopped.batch, { author: keeper });
    expect(suggestions(store)).toHaveLength(1);
  });

  it("will not let a seat that may decide one record's silence that kind on everyone's", () => {
    const store = storeOf(POLICY);
    const own = suggest(store, [editNote("one")], { author: actor, lineage })!;
    suggest(store, [editNote("two", "other")], { author: actor, lineage });
    const waiting = suggestions(store, member).find((one) => one.id === own.id)!;
    expect(mayStopSuggesting(store, waiting, member)).toBe(false);
    expect(() => stopSuggesting(store, own.id, { author: member })).toThrow(/may decide/);
    expect(suggestions(store)).toHaveLength(2);
    expect(mayStopSuggesting(store, waiting, keeper)).toBe(true);
  });
});

describe("a stop behind a checkpoint", () => {
  function compacted() {
    const store = storeOf(POLICY);
    const stopped = stopSuggesting(store, suggest(store, [editNote("one")], { author: actor, lineage })!.id, { author: keeper });
    store.apply({ name: "finish", args: { id: "two" } }, { author: keeper });
    store.apply({ name: "finish", args: { id: "three" } }, { author: keeper });
    store.compact(store.checkpoint({ keepOps: 1, keepDays: 0 })!);
    expect(store.log.get(stopped.ops[0]!.id)).toBeUndefined();
    return { store, stopped };
  }

  it("is still listed, in its words, with its batch", () => {
    const { store, stopped } = compacted();
    expect(stoppedSuggestions(store)).toEqual([{ batch: stopped.batch, words: "Stopped suggesting changes to the note of tasks" }]);
    expect(() => suggest(store, [editNote("two", "other")], { author: actor, lineage })).toThrow(/this kind of thing/);
  });

  it("can be lifted, by whoever may decide it and nobody else", () => {
    const { store, stopped } = compacted();
    expect(store.mayUndo(stopped.batch, reader).ok).toBe(false);
    expect(() => store.undo(stopped.batch, { author: reader })).toThrow();
    expect(store.mayUndo(stopped.batch, keeper).ok).toBe(true);
    store.undo(stopped.batch, { author: keeper });
    expect(stoppedSuggestions(store)).toEqual([]);
    expect(declined(store, [editNote("one")])).toBeUndefined();
    expect(suggest(store, [editNote("two", "other")], { author: actor, lineage })).toBeDefined();
  });

  it("stays lifted across the next checkpoint", () => {
    const { store, stopped } = compacted();
    store.undo(stopped.batch, { author: keeper });
    store.apply({ name: "finish", args: { id: "one" } }, { author: keeper });
    store.compact(store.checkpoint({ keepOps: 1, keepDays: 0 })!);
    expect(stoppedSuggestions(store)).toEqual([]);
    expect(suggest(store, [editNote("two", "other")], { author: actor, lineage })).toBeDefined();
  });

  it("keeps its words from a seat that may not see what it named", () => {
    const store = storeOf(POLICY);
    stopSuggesting(store, suggest(store, [renameSecret], { author: actor, lineage })!.id, { author: keeper });
    store.apply({ name: "finish", args: { id: "two" } }, { author: keeper });
    store.apply({ name: "finish", args: { id: "three" } }, { author: keeper });
    store.compact(store.checkpoint({ keepOps: 1, keepDays: 0 })!);
    expect(stoppedSuggestions(store, keeper)).toHaveLength(1);
    expect(stoppedSuggestions(store, reader)).toEqual([]);
    expect(JSON.stringify(store.seenBy(reader).log.horizonEpoch() ?? {})).not.toContain("Stopped suggesting");
  });
});

describe("the lineage keys a stop is made of", () => {
  const make = { name: "finish", args: { id: "one" } };

  it("are not a client's to say: liftedStop on an apply is refused, and the change stays undoable", () => {
    const store = storeOf(POLICY);
    expect(() => store.apply(make, { author: keeper, lineage: { basis: "x", liftedStop: true } })).toThrow(/lift a stop/);
    const made = store.apply(make, { author: keeper });
    expect(store.mayUndo(made.batch, keeper).ok).toBe(true);
  });

  it("refuses liftedStop on an undo, and stopsKind on an apply or a suggestion", () => {
    const store = storeOf();
    const made = store.apply(make, { author: keeper });
    expect(() => store.undo(made.batch, { author: keeper, lineage: { basis: "x", liftedStop: true } })).toThrow(/lift a stop/);
    expect(() => store.apply({ name: "finish", args: { id: "two" } }, { author: keeper, lineage: { basis: "x", stopsKind: true } })).toThrow(/not to suggest/);
    expect(() => suggest(store, [editNote("one")], { author: actor, lineage: { basis: "x", stopsKind: true } })).toThrow(/not to suggest/);
  });
});

describe("a stop whose suggestion a checkpoint archived and whose own op is still in the tail", () => {
  function archived() {
    const store = storeOf(POLICY);
    const made = suggest(store, [editNote("one")], { author: actor, lineage })!;
    store.apply({ name: "finish", args: { id: "two" } }, { author: keeper });
    store.apply({ name: "finish", args: { id: "three" } }, { author: keeper });
    const stopped = stopSuggesting(store, made.id, { author: keeper });
    store.apply({ name: "finish", args: { id: "one" } }, { author: keeper });
    store.compact(store.checkpoint({ keepOps: 2, keepDays: 0 })!);
    expect(store.log.get(made.id)).toBeUndefined();
    expect(store.log.get(stopped.ops[0]!.id)).toBeDefined();
    return { store, stopped };
  }

  it("is not lifted by a seat that may not decide it", () => {
    const { store, stopped } = archived();
    expect(store.mayUndo(stopped.batch, reader).ok).toBe(false);
    expect(() => store.undo(stopped.batch, { author: reader })).toThrow();
  });

  it("is lifted by whoever may", () => {
    const { store, stopped } = archived();
    expect(store.mayUndo(stopped.batch, keeper).ok).toBe(true);
  });
});

describe("a stop speaks for a kind", () => {
  it("so a seat that may edit only its own record may not say it, even with nothing else waiting", () => {
    const store = storeOf(POLICY);
    const own = suggest(store, [editNote("one")], { author: actor, lineage })!;
    expect(mayStopSuggesting(store, suggestions(store, member)[0]!, member)).toBe(false);
    expect(() => stopSuggesting(store, own.id, { author: member })).toThrow(/may decide/);
    expect(mayStopSuggesting(store, suggestions(store)[0]!, keeper)).toBe(true);
  });

  it("and the same seat may not lift one", () => {
    const store = storeOf(POLICY);
    const stopped = stopSuggesting(store, suggest(store, [editNote("one")], { author: actor, lineage })!.id, { author: keeper });
    expect(store.mayUndo(stopped.batch, member).ok).toBe(false);
    expect(store.mayUndo(stopped.batch, keeper).ok).toBe(true);
  });
});

describe("the app's own actor, and only it", () => {
  const stop = (store: ReturnType<typeof storeOf>) => stopSuggesting(store, suggest(store, [editNote("one")], { author: actor, lineage })!.id);

  it("may not make what it was stopped from suggesting", () => {
    const store = storeOf();
    stop(store);
    expect(() => store.apply(editNote("two", "other"), { author: actor, lineage })).toThrow(/this kind of thing/);
  });

  it("is marked: an importer, a host's triage and a workflow's custom seat are automated and not it", () => {
    for (const other of [{ kind: "system", id: "importer", automated: true }, { kind: "system", id: "cloud:triage", automated: true }, { kind: "system", id: "custom", name: "Next week", automated: true }, { kind: "system", id: "workflow:next", automated: true }] as Author[]) expect(isTidyingActor(other)).toBe(false);
    expect(isTidyingActor(actor)).toBe(true);
    expect(isTidyingActor({ kind: "human", id: "kay", tidying: true } as Author)).toBe(false);
    const store = storeOf();
    stop(store);
    const importer: Author = { kind: "system", id: "importer", automated: true };
    expect(store.apply(editNote("two", "other"), { author: importer, lineage }).ops.length).toBeGreaterThan(0);
    expect(suggest(store, [editNote("three", "other")], { author: importer, lineage })).toBeDefined();
  });

  it("is still asked about a change with a field it was not stopped from", () => {
    const store = storeOf();
    stop(store);
    expect(suggest(store, [{ name: "edit-task", args: { id: "two", note: "n", label: "L" } }], { author: actor, lineage })).toBeDefined();
  });
});

describe("a hidden stop lifted behind a checkpoint", () => {
  it("tells a kept-out seat nothing of its kind or field", () => {
    const store = storeOf(POLICY);
    const stopped = stopSuggesting(store, suggest(store, [renameSecret], { author: actor, lineage })!.id, { author: keeper });
    store.apply({ name: "finish", args: { id: "two" } }, { author: keeper });
    store.apply({ name: "finish", args: { id: "three" } }, { author: keeper });
    store.compact(store.checkpoint({ keepOps: 1, keepDays: 0 })!);
    store.undo(stopped.batch, { author: keeper });
    const told = JSON.stringify(store.seenBy(reader).log.all());
    expect(told).not.toMatch(/name of|secrets|Stopped suggesting|Layoff/i);
    expect(store.seenBy(reader).log.all().at(-1)!.withheld).toBe(true);
  });
});
