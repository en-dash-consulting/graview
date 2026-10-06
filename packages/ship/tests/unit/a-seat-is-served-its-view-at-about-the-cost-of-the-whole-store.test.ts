import { bindSchema, createSchema, defineNode, nodeRef, Store, type AnySchema, type GraphSnapshot, type Operation, type Policy, type Principal } from "@graview/core";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { liveProtocol, type LiveProtocol } from "../../src/runtime.js";

/**
 * A SEAT IS SERVED ITS VIEW AT ABOUT THE COST OF THE WHOLE STORE (FR-55).
 *
 * The seat view judges every string of every op a seat is served, so a
 * planner's `GET /graview/state` over a 10,000-op log took 36 ms where it
 * had taken 20, and making the protocol again on a wake 5.3 ms where it
 * had taken 3.4. Measured against the same read for the system — the whole
 * store, nothing kept from it — in the same process, so a slower machine
 * moves both: a log that only grew is served from what was served before
 * it grew, and a protocol made on a wake reads nothing until it is asked.
 * Ceilings generous enough for a busy runner, and half of what doubling
 * either cost would take.
 */
const task = defineNode("task", { fields: z.object({ title: z.string(), ref: z.string().optional() }), plural: "Tasks" });
const person = defineNode("person", { fields: z.object({ title: z.string() }), plural: "People" });
const schema = createSchema([task, person]);
const { defineMutation } = bindSchema(schema);
const add = defineMutation("add", {
  title: "Add",
  creates: ["task"],
  input: z.object({ title: z.string() }),
  apply(ctx, args) {
    ctx.addNode({ id: ctx.freshId(args.title, "task"), kind: "task", title: args.title });
  },
});
const retitle = defineMutation("retitle", {
  title: "Retitle",
  subject: { kinds: ["task"], arg: "id" },
  writes: ["title"],
  input: z.object({ id: nodeRef(["task"]), title: z.string() }),
  apply(ctx, args) {
    ctx.patchNode(args.id, { title: args.title });
  },
});
const point = defineMutation("point", {
  title: "Point",
  subject: { kinds: ["task"], arg: "id" },
  writes: ["ref"],
  input: z.object({ id: nodeRef(["task"]), ref: z.string() }),
  apply(ctx, args) {
    ctx.patchNode(args.id, { ref: args.ref });
  },
});
const mutations = [add, retitle, point] as never;
const schemaOfAll = schema as unknown as AnySchema;
// A planner sees the people, and only the tasks it made; an owner sees everything.
const policy: Policy = {
  grants: [{ roles: "*", mutations: "*" }],
  sees: [
    { roles: ["planner", "owner"], kinds: ["person"] },
    { roles: ["planner"], kinds: ["task"], own: true },
    { roles: ["owner"], kinds: ["task"] },
  ],
};
const planner: Principal = { kind: "human", id: "person:pat", roles: ["planner"] };
const owner: Principal = { kind: "human", id: "person:mo", roles: ["owner"] };
const system: Principal = { kind: "system" };

/** A log of `count` acts: half of them the planner's own tasks, the rest the owner's, some pointing a task's ref at somebody else's. */
function history(count: number): { readonly snapshot: GraphSnapshot; readonly log: readonly Operation[] } {
  const store = new Store<AnySchema>({ schema: schemaOfAll, mutations, policy });
  let seed = 7;
  const next = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  const ids: string[] = [];
  for (let at = 0; at < count; at++) {
    const roll = next();
    if (ids.length < 5 || roll < 0.5) ids.push(store.applyAll([{ name: "add", args: { title: `Task ${at}` } }], { author: next() < 0.5 ? planner : owner }).ops[0]!.writes[0]!);
    else if (roll < 0.85) store.applyAll([{ name: "retitle", args: { id: ids[Math.floor(next() * ids.length)]!, title: `T ${at}` } }], { author: owner });
    else store.applyAll([{ name: "point", args: { id: ids[Math.floor(next() * ids.length)]!, ref: ids[Math.floor(next() * ids.length)]! } }], { author: owner });
  }
  return { snapshot: store.snapshot(), log: store.log.all() };
}

/** The quickest of several tries: what a read costs when nothing else on the machine is in its way. */
const fastest = (times: readonly number[]): number => Math.min(...times);
const timed = (run: () => unknown): number => {
  const started = performance.now();
  run();
  return performance.now() - started;
};

/*
 * A shared runner's clock is noisy: another job on the machine can land on any one sample. Each
 * claim is measured again, up to twice, before it fails; a read that really cost more fails all three.
 */
const MEASURED_AGAIN = { retry: 2 };

describe("a seat is served its view at about the cost of the whole store", () => {
  const { snapshot, log } = history(2000);
  // What a host holds after a wake: the store opened from what it keeps.
  const woken = () => new Store<AnySchema>({ schema: schemaOfAll, mutations, policy, snapshot, log, validate: false });
  const read = (live: LiveProtocol<AnySchema>, seat: Principal) => JSON.stringify(live.state({ seat, via: "web" }).body);

  it("makes the protocol on a wake for a small part of one whole-store read", MEASURED_AGAIN, () => {
    const made: number[] = [];
    const whole: number[] = [];
    for (let round = 0; round < 9; round++) {
      const store = woken();
      made.push(timed(() => liveProtocol({ store })));
      const live = liveProtocol({ store });
      whole.push(timed(() => read(live, system)));
    }
    expect(fastest(made) / fastest(whole), `made ${fastest(made).toFixed(2)} ms, a whole read ${fastest(whole).toFixed(2)} ms`).toBeLessThan(0.1);
  });

  it("serves a planner and an owner their state, read again and after the log grew, for at most 1.75 whole-store reads", MEASURED_AGAIN, () => {
    const times: Record<string, number[]> = { system: [], "system, after the log grew": [], planner: [], owner: [], "planner, after the log grew": [], "planner, first after a wake": [] };
    // A round first that is not counted: the first of anything in a process is the compiler's.
    for (let round = 0; round < 12; round++) {
      const store = woken();
      const live = liveProtocol({ store });
      const first = timed(() => read(live, planner));
      read(live, owner);
      const whole = [timed(() => read(live, system)), timed(() => read(live, system))];
      const again = timed(() => read(live, planner));
      const owned = timed(() => read(live, owner));
      for (let more = 0; more < 10; more++) store.applyAll([{ name: "add", args: { title: `More ${round}.${more}` } }], { author: more % 2 ? planner : owner });
      read(live, planner);
      for (let more = 0; more < 10; more++) store.applyAll([{ name: "add", args: { title: `Again ${round}.${more}` } }], { author: more % 2 ? planner : owner });
      // The grown read is judged against the whole of the same grown store, read either side of it,
      // so a pause that lands after the writes is not charged to the seat alone.
      const before = timed(() => read(live, system));
      const grown = timed(() => read(live, planner));
      const wholeGrown = [before, timed(() => read(live, system))];
      if (round === 0) continue;
      times["system, after the log grew"]!.push(...wholeGrown);
      times["system"]!.push(...whole);
      times["planner, first after a wake"]!.push(first);
      times["planner"]!.push(again);
      times["owner"]!.push(owned);
      times["planner, after the log grew"]!.push(grown);
    }
    const against = (who: string) => fastest(times[who === "planner, after the log grew" ? "system, after the log grew" : "system"]!);
    const ratio = (who: string) => fastest(times[who]!) / against(who);
    const said = Object.keys(times)
      .map((who) => `${who} ${fastest(times[who]!).toFixed(2)} ms (${ratio(who).toFixed(2)}x)`)
      .join(", ");
    expect(ratio("planner"), said).toBeLessThan(1.75);
    expect(ratio("owner"), said).toBeLessThan(1.75);
    expect(ratio("planner, after the log grew"), said).toBeLessThan(1.75);
    // The first read after a wake judges the whole log: it may cost more, never much more than it does
    // now. It measures 4.2–4.8x here and 8.08x once on CI's runner (2026-10-05), where a cold JIT costs
    // the one read the most; the ceiling holds half again over that, and a read that judged every op
    // twice would still cross it.
    expect(ratio("planner, first after a wake"), said).toBeLessThan(12);
  });
});
