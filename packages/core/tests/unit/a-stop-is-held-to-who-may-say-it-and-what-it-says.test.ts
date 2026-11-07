import { describe, expect, it } from "vitest";
import { bindSchema, createSchema, defineNode, nodeRef, Store, z, type Author, type Policy, type Principal } from "../../src/index.js";
import { redact } from "../../src/ops/withheld.js";
import { seatLens } from "../../src/seen.js";
import { declined, declineSuggestion, foldDigests, isTidyingActor, mayStopSuggesting, servedStops, stoppedKind, stoppedSuggestions, stopSuggesting, suggest, suggestions } from "../../src/tidying.js";

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

describe("who may stop a kind, by every shape a grant takes", () => {
  const POLICIES: Record<string, { grants: Policy["grants"]; may: boolean }> = {
    "every act": { grants: [{ roles: ["member"], mutations: "*" }], may: true },
    "the act by name": { grants: [{ roles: ["member"], mutations: ["edit-task"] }], may: true },
    "the act, on its kind": { grants: [{ roles: ["member"], mutations: ["edit-task"], kinds: ["task"] }], may: true },
    "every act, on another kind": { grants: [{ roles: ["member"], mutations: "*", kinds: ["secret"] }], may: false },
    "their own record": { grants: [{ roles: ["member"], mutations: ["edit-task"], self: true }], may: false },
    "their own end of a link": { grants: [{ roles: ["member"], mutations: ["edit-task"], ownEnd: true }], may: false },
    "an act it rides, by role": { grants: [{ roles: ["member"], mutations: ["finish"] }], may: true },
    "the making of the kind, by everyone": { grants: [{ roles: "*", mutations: ["make-task"] }], may: false },
  };
  const make = defineMutation("make-task", { title: "Make", creates: ["task"], input: z.object({ id: z.string(), label: z.string() }), apply(ctx, args) { ctx.addNode({ id: args.id, kind: "task", label: args.label }); } });
  for (const [shape, { grants, may }] of Object.entries(POLICIES))
    it(`${may ? "is" : "is not"} said by a seat with ${shape}`, () => {
      const store = new Store({ schema, mutations: [finish, make], policy: { roles: ["member"], grants }, snapshot: { nodes: NODES, edges: [] } as never });
      const made = suggest(store, [editNote("one")], { author: actor, lineage })!;
      const waiting = suggestions(store).find((one) => one.id === made.id)!;
      expect(mayStopSuggesting(store, waiting, member)).toBe(may);
    });

  it("is not said by a seat that made the only record of the kind, and it can be lifted by whoever could say it after another is made", () => {
    const policy: Policy = { roles: ["keeper", "member"], grants: [{ roles: ["keeper"], mutations: "*" }, { roles: "*", mutations: ["make-task"] }] };
    const store = new Store({ schema, mutations: [make], policy, snapshot: { nodes: [], edges: [] } as never });
    store.apply({ name: "make-task", args: { id: "one", label: "Mine" } }, { author: member });
    const made = suggest(store, [editNote("one")], { author: actor, lineage })!;
    expect(() => stopSuggesting(store, made.id, { author: member })).toThrow(/may decide/);
    const stopped = stopSuggesting(store, made.id, { author: keeper });
    store.apply({ name: "make-task", args: { id: "two", label: "Theirs" } }, { author: keeper });
    expect(store.mayUndo(stopped.batch, keeper).ok).toBe(true);
    expect(store.mayUndo(stopped.batch, member).ok).toBe(false);
  });
});

describe("a large kind", () => {
  const many = (count: number) => [...Array(count).keys()].map((at) => ({ id: `t${at}`, kind: "task", label: `T${at}` }));
  const counted = (store: Store<typeof schema>) => {
    let asked = 0;
    const permits = store.permits.bind(store);
    store.permits = ((...args: Parameters<typeof permits>) => (asked++, permits(...args))) as typeof store.permits;
    return () => asked;
  };

  it("costs each row of a seat that decides it a few questions, however many records it has", () => {
    const store = new Store({ schema, mutations: [finish], policy: { roles: ["keeper"], grants: [{ roles: ["keeper"], mutations: "*" }] }, snapshot: { nodes: many(20_000), edges: [] } as never });
    for (let at = 0; at < 50; at++) suggest(store, [editNote(`t${at}`, "n")], { author: actor, lineage });
    const rows = suggestions(store);
    const asked = counted(store);
    for (const row of rows) expect(mayStopSuggesting(store, row, keeper)).toBe(true);
    expect(asked()).toBeLessThan(1000);
  });

  it("costs a seat with its own record no walk at all", () => {
    const store = new Store({ schema, mutations: [finish], policy: { roles: ["member"], grants: [{ roles: ["member"], mutations: ["edit-task"], self: true }] }, snapshot: { nodes: [...many(20_000), { id: "one", kind: "task", label: "One" }], edges: [] } as never });
    const made = suggest(store, [editNote("one")], { author: actor, lineage })!;
    const row = suggestions(store).find((one) => one.id === made.id)!;
    const asked = counted(store);
    expect(mayStopSuggesting(store, row, member)).toBe(false);
    expect(asked()).toBeLessThan(10);
  });

  it("walks a kind once a graph tick for a seat with limited sight, not once a row", () => {
    const store = new Store({ schema, mutations: [finish], policy: { roles: ["keeper", "member"], grants: [{ roles: ["keeper", "member"], mutations: "*" }], sees: [{ roles: ["keeper"], kinds: ["task", "secret"] }, { roles: ["member"], kinds: ["task"] }] }, snapshot: { nodes: many(2_000), edges: [] } as never });
    for (let at = 0; at < 20; at++) suggest(store, [editNote(`t${at}`, "n")], { author: actor, lineage });
    const rows = suggestions(store);
    const asked = counted(store);
    for (const row of rows) mayStopSuggesting(store, row, member);
    expect(asked()).toBeLessThan(2_000 + 500);
  });

  it("tells a host what it told before, without working it out again, until the log moves", () => {
    const store = new Store({ schema, mutations: [finish], policy: { roles: ["keeper"], grants: [{ roles: ["keeper"], mutations: "*" }] }, snapshot: { nodes: many(1_000), edges: [] } as never });
    stopSuggesting(store, suggest(store, [editNote("t1")], { author: actor, lineage })!.id, { author: keeper });
    expect(servedStops(store, keeper)).toBe(servedStops(store, keeper));
  });
});

describe("what a stop behind a checkpoint says, and to whom", () => {
  const stoppedOn = (call: { name: string; args: Record<string, unknown> }) => {
    const store = storeOf(POLICY);
    const stopped = stopSuggesting(store, suggest(store, [call], { author: actor, lineage })!.id, { author: keeper });
    store.apply({ name: "finish", args: { id: "two" } }, { author: keeper });
    store.apply({ name: "finish", args: { id: "three" } }, { author: keeper });
    store.compact(store.checkpoint({ keepOps: 1, keepDays: 0 })!);
    return { store, stopped };
  };

  it("keeps it from a seat when any argument names what is kept, not only the subject", () => {
    // The subject is in sight; the note names a record that is not.
    expect(stoppedSuggestions(stoppedOn({ name: "edit-task", args: { id: "one", note: "plan" } }).store, reader)).toEqual([]);
    expect(stoppedSuggestions(stoppedOn({ name: "edit-task", args: { id: "one", note: "plain" } }).store, reader)).toHaveLength(1);
  });

  it("is refused to a seat it is kept from, by its raw batch, and the store stays as it was", () => {
    const seatMayAct: Policy = { roles: ["keeper", "member"], grants: [{ roles: ["keeper", "member"], mutations: "*" }], sees: [{ roles: ["keeper"], kinds: ["task", "secret"] }, { roles: ["member"], kinds: ["task"] }] };
    const store = storeOf(seatMayAct);
    const stopped = stopSuggesting(store, suggest(store, [renameSecret], { author: actor, lineage })!.id, { author: keeper });
    store.apply({ name: "finish", args: { id: "two" } }, { author: keeper });
    store.apply({ name: "finish", args: { id: "three" } }, { author: keeper });
    store.compact(store.checkpoint({ keepOps: 1, keepDays: 0 })!);
    expect(store.mayUndo(stopped.batch, member).ok).toBe(false);
    expect(() => store.undo(stopped.batch, { author: member })).toThrow();
    expect(stoppedSuggestions(store, keeper)).toHaveLength(1);
  });

  it("reads as what it is to whoever lifted it, and to a seat it names nothing kept from", () => {
    const { store, stopped } = stoppedOn({ name: "edit-task", args: { id: "one", note: "plain" } });
    store.undo(stopped.batch, { author: keeper });
    const reads = (who: Principal) => store.seenBy(who).log.all().at(-1)!;
    expect(reads(reader).withheld).toBeUndefined();
    expect(reads(reader).intent).toMatch(/Stopped suggesting changes to the note of tasks/);
    expect(reads(keeper).withheld).toBeUndefined();
  });

  it("reads as their own to a seat kept from something else, who lifted it", () => {
    const seatMayAct: Policy = { roles: ["keeper", "member"], grants: [{ roles: ["keeper", "member"], mutations: "*" }], sees: [{ roles: ["keeper"], kinds: ["task", "secret"] }, { roles: ["member"], kinds: ["task"] }] };
    const store = storeOf(seatMayAct);
    const stopped = stopSuggesting(store, suggest(store, [editNote("one")], { author: actor, lineage })!.id, { author: keeper });
    store.apply({ name: "finish", args: { id: "two" } }, { author: keeper });
    store.apply({ name: "finish", args: { id: "three" } }, { author: keeper });
    store.compact(store.checkpoint({ keepOps: 1, keepDays: 0 })!);
    store.undo(stopped.batch, { author: member });
    const op = store.seenBy(member).log.all().at(-1)!;
    expect(op.withheld).toBeUndefined();
    expect(op.intent).toMatch(/Stopped suggesting/);
  });

  it("stays withheld, whole read and slice alike, from a seat kept from what it names", () => {
    const { store, stopped } = stoppedOn(renameSecret);
    store.undo(stopped.batch, { author: keeper });
    const all = store.seenBy(reader).log.all();
    expect(all.at(-1)!.withheld).toBe(true);
    expect(JSON.stringify(all)).not.toMatch(/Stopped suggesting|name of|Layoff|secrets/i);
    const slice = redact(store.log.all().slice(-1), seatLens(store as never, reader));
    expect(slice[0]!.withheld).toBe(true);
    expect(JSON.stringify(slice)).not.toMatch(/Stopped suggesting|name of|Layoff|secrets/i);
  });
});

describe("the app's own actor bundling", () => {
  it("is refused a change with any call of a stopped kind in it", () => {
    const store = storeOf();
    stopSuggesting(store, suggest(store, [editNote("one")], { author: actor, lineage })!.id);
    expect(() => store.applyAll([editNote("two", "other"), editLabel("three")], { author: actor, lineage })).toThrow(/this kind of thing/);
    expect(store.graph.getNode("two")).not.toMatchObject({ note: "other" });
    // Still asked about, where a person decides it.
    expect(suggest(store, [editNote("two", "other"), editLabel("three")], { author: actor, lineage })).toBeDefined();
  });
});

describe("a log kept by a build before these keys meant anything", () => {
  const opened = (ops: readonly object[]) => new Store({ schema, mutations: [finish], log: [...storeOf().log.all(), ...ops] as never, snapshot: { nodes: NODES, edges: [] } as never });
  const AT = "2026-11-01T00:00:00.000Z";
  const person = { kind: "human", id: "kay", roles: ["keeper"] };
  const made = { id: "op1", seq: 0, batch: "batch:a:1", author: person, intent: "Finish", mutation: { name: "finish", args: { id: "one" } }, primitives: [{ op: "patch-node", id: "one", before: {}, after: { owner: "done" } }], reads: [], writes: ["one"], at: AT };

  it("treats liftedStop on a change as nothing: it can still be undone", () => {
    const store = opened([{ ...made, lineage: { basis: "x", liftedStop: true } }]);
    expect(store.mayUndo("batch:a:1", keeper).ok).toBe(true);
  });

  it("treats stopsKind on a change as nothing: it can still be undone", () => {
    const store = opened([{ ...made, lineage: { basis: "x", stopsKind: true } }]);
    expect(store.mayUndo("batch:a:1", keeper).ok).toBe(true);
  });

  it("treats stopsKind on an undo of a change as nothing", () => {
    const store = opened([made, { id: "op2", seq: 1, batch: "undo:a:2", author: person, intent: "Undo: Finish", mutation: null, primitives: [{ op: "patch-node", id: "one", before: { owner: "done" }, after: {} }], reads: [], writes: ["one"], at: AT, undoes: "op1", lineage: { basis: "x", stopsKind: true } }]);
    expect(stoppedSuggestions(store)).toEqual([]);
    expect(store.mayUndo("undo:a:2", keeper).ok).toBe(true);
    expect(stoppedKind(store, [{ name: "finish", args: { id: "two" } }])).toBeUndefined();
  });

  it("treats stopsKind on a decline of an unmarked actor's suggestion as an ordinary decline", () => {
    const unmarked = { id: "op1", seq: 0, batch: "batch:a:1", author: { kind: "system", id: "tidying", automated: true }, intent: "Change", mutation: null, primitives: [], reads: [], writes: [], at: AT, suggests: [editNote("one")], lineage: { basis: "b" } };
    const decline = { id: "op2", seq: 1, batch: "undo:a:2", author: person, intent: "Undo: Change", mutation: null, primitives: [], reads: [], writes: [], at: AT, undoes: "op1", lineage: { basis: "x", stopsKind: true }, batchIntent: "Anything at all" };
    const store = opened([unmarked, decline]);
    expect(stoppedSuggestions(store)).toEqual([]);
    expect(stoppedKind(store, [editNote("two", "other")])).toBeUndefined();
    expect(foldDigests(store.batches(), (id) => store.log.get(id))).toEqual([]);
  });

  it("does not let liftedStop on an undo whose target the log holds change anything", () => {
    const store = opened([made, { id: "op2", seq: 1, batch: "undo:a:2", author: person, intent: "Undo: Finish", mutation: null, primitives: [], reads: [], writes: [], at: AT, undoes: "op1", lineage: { basis: "x", liftedStop: true } }]);
    expect(store.mayUndo("undo:a:2", keeper).ok).toBe(true);
  });
});
