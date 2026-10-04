import { describe, expect, it } from "vitest";
import { createSchema, defineNode, logSeenBy, redact, seatLens, Store, z, type AnySchema, type Operation, type Principal } from "../../src/index.js";
import { rng, storeAt, world } from "../support/unseen-worlds.js";

/**
 * A SERVED LOG THAT ONLY GREW IS THE LOG SERVED WHOLE (FR-55).
 *
 * `logSeenBy` keeps what it served a seat, and serves a log that only grew
 * from it, judging only the new ops — unless one of them moved something
 * the old ones were judged by. Whatever it keeps, it must serve exactly
 * what redacting the whole log afresh serves: these hold it to that, in
 * random worlds grown an op at a time and read at random moments.
 */
const WORLDS = 1000;
const ROLES = ["r1", "r2", "r3"];

const fresh = (store: Store<AnySchema>, seat: Principal): Operation[] => redact(store.log.all(), seatLens(store, seat));

describe("a log that only grew is served as if read whole", () => {
  it(`serves exactly what redacting the whole log serves, read at random moments as it grows — ${WORLDS.toLocaleString("en")} random worlds`, () => {
    let extended = 0;
    for (let seed = 1; seed <= WORLDS; seed++) {
      const w = world(seed, { required: seed % 2 === 0 });
      const r = rng(seed * 104729);
      // A seat that is a record itself, too: a link to it brings what it links into its sight, and takes it out again.
      const first = w.ops[0]!.primitives.find((primitive) => primitive.op === "add-node");
      const seats: Principal[] = [
        w.viewer,
        { kind: "human", id: w.pick(["u1", "u2", "u3"]), roles: ROLES.filter(() => r() < 0.5) },
        { kind: "human", id: first?.op === "add-node" ? first.node.id : "u1", roles: ROLES.filter(() => r() < 0.7) },
      ];
      const store = storeAt(w, 0);
      for (const [at, op] of w.ops.entries()) {
        store.receive([op]);
        if (r() < 0.4 || at === w.ops.length - 1) {
          for (const seat of seats) {
            const kept = logSeenBy(store, seat);
            // Equal as served — the same ops, primitives and fields — whatever order a record's fields were written in.
            expect(kept, `seed ${seed}, after op ${at}, seat ${seat.id}`).toEqual(fresh(store, seat));
            extended++;
          }
        }
      }
      // Read twice without a change: the same answer.
      for (const seat of seats) expect(logSeenBy(store, seat)).toEqual(fresh(store, seat));
    }
    expect(extended).toBeGreaterThan(WORLDS * 4);
  }, 300_000);

  /*
   * An op that names an id before any record has it names nothing, and is
   * served whole. The record made later, hidden from the seat, makes that
   * name one the seat may not be told: the op served before is served
   * again, withheld, not left as it was.
   */
  const note = defineNode("note", { fields: z.object({ title: z.string(), about: z.string().optional() }) });
  const secret = defineNode("secret", { fields: z.object({ title: z.string() }) });
  const schema = createSchema([note, secret]) as unknown as AnySchema;
  const policy = { grants: [{ roles: "*" as const, mutations: "*" as const }], sees: [{ roles: ["reader"], kinds: ["note"] }] };
  const reader: Principal = { kind: "human", id: "reader:ada", roles: ["reader"] };
  const op = (seq: number, primitives: Operation["primitives"], intent = `step ${seq}`): Operation => ({
    id: `op${seq + 1}`,
    seq,
    batch: `batch:${seq + 1}`,
    author: { kind: "human", id: "u9" },
    intent,
    mutation: null,
    primitives,
    inverse: [],
    reads: [],
    writes: [],
    at: "2026-10-04T00:00:00.000Z",
  });

  it("serves an op again, withheld, once a record it named before it existed is made where the seat cannot see it", () => {
    const store = new Store<AnySchema>({ schema, policy });
    store.receive([op(0, [{ op: "add-node", node: { id: "note:a", kind: "note", title: "A", about: "secret:plans" } }])]);
    const before = logSeenBy(store, reader);
    expect(JSON.stringify(before)).toContain("secret:plans");
    store.receive([op(1, [{ op: "add-node", node: { id: "secret:plans", kind: "secret", title: "Plans" } }])]);
    const after = logSeenBy(store, reader);
    expect(after).toEqual(fresh(store, reader));
    expect(JSON.stringify(after)).not.toContain("secret:plans");
  });

  it("serves an op again once a record it was withheld for comes into the seat's sight", () => {
    const own = { grants: [{ roles: "*" as const, mutations: "*" as const }], sees: [{ roles: ["reader"], kinds: ["note"], own: true }, { roles: ["reader"], kinds: ["secret"] }] };
    const store = new Store<AnySchema>({ schema: createSchema([defineNode("note", { fields: z.object({ title: z.string() }), edges: { by: { to: ["secret"], cardinality: "many" } } }), secret]) as unknown as AnySchema, policy: own });
    const seat: Principal = { kind: "human", id: "secret:ada", roles: ["reader"] };
    store.receive([
      op(0, [{ op: "add-node", node: { id: "secret:ada", kind: "secret", title: "Ada" } }]),
      op(1, [{ op: "add-node", node: { id: "note:b", kind: "note", title: "B" } }], "note:b"),
    ]);
    expect(JSON.stringify(logSeenBy(store, seat))).not.toContain("note:b");
    // Joined to Ada by a link: hers now, and so is every op about it.
    store.receive([op(2, [{ op: "add-edge", edge: { kind: "by", from: "note:b", to: "secret:ada" } }])]);
    const after = logSeenBy(store, seat);
    expect(after).toEqual(fresh(store, seat));
    expect(JSON.stringify(after)).toContain("note:b");
  });
});
