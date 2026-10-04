import { afterEach, describe, expect, it } from "vitest";
import {
  bindSchema,
  createSchema,
  defineNode,
  nodeRef,
  Store,
  z,
  type ApplyOptions,
  type MutationCall,
  type Operation,
  type PlannedChange,
  type Policy,
  type Principal,
} from "../../src/index.js";

/**
 * A PREVIEW IS JUDGED AS ITS BATCH WOULD BE (FR-56).
 *
 * `store.previewAll(calls, options)` takes what `applyAll` takes — the
 * author, the channel, the batch, the intent and the host's `admit` — and
 * runs `applyAll`'s own path on a rehearsal of the store: its graph and its
 * log, copied, heard by nobody. So it refuses exactly when the apply would,
 * for the same reason in the same words — the policy, the seat's sight, an
 * act's own guard, whatever `admit` throws — and when it would not, it says
 * the ops as they would be logged (ids `preview:<n>`, the seq each would
 * take, `kept: false`) with the problems the graph would have after. It
 * writes, logs and tells nothing.
 */
const person = defineNode("person", { fields: z.object({ label: z.string() }), plural: "People" });
const note = defineNode("note", {
  fields: z.object({ label: z.string(), state: z.enum(["open", "done"]).default("open") }),
  edges: { about: { to: ["person"], cardinality: "many" } },
  plural: "Notes",
});
const schema = createSchema([person, note]);
const { defineMutation, defineInvariant } = bindSchema(schema);

const jot = defineMutation("jot", {
  title: "Jot a note",
  creates: ["note"],
  input: z.object({ id: z.string(), label: z.string() }),
  apply(ctx, args) {
    ctx.addNode({ id: args.id, kind: "note", label: args.label, state: "open" } as never);
  },
});
// A guard in the act's own words, which reads the record it refuses over.
const rename = defineMutation("rename-note", {
  title: "Rename the note",
  subject: { kinds: ["note"], arg: "id" },
  writes: ["label"],
  input: z.object({ id: nodeRef(["note"]), label: z.string() }),
  apply(ctx, args) {
    const was = ctx.graph.getNode(args.id) as { label: string } | undefined;
    if (args.label === "forbidden") throw new Error(`“${was?.label}” may not be called that.`);
    ctx.patchNode(args.id, { label: args.label } as never);
  },
});
// A guard that decides to do nothing: closing what is closed.
const finish = defineMutation("finish-note", {
  title: "Finish the note",
  subject: { kinds: ["note"], arg: "id" },
  writes: ["state"],
  input: z.object({ id: nodeRef(["note"]) }),
  apply(ctx, args) {
    if ((ctx.graph.getNode(args.id) as { state?: string } | undefined)?.state === "done") return;
    ctx.patchNode(args.id, { state: "done" } as never);
  },
});
const tear = defineMutation("tear-note", {
  title: "Tear up the note",
  subject: { kinds: ["note"], arg: "id" },
  input: z.object({ id: nodeRef(["note"]) }),
  apply(ctx, args) {
    ctx.removeNode(args.id);
  },
});
const named = defineInvariant("a-note-says-something", {
  scope: { kind: "note" },
  evaluate: ({ subject }) =>
    subject.label.trim() === "" ? [{ invariant: "a-note-says-something", label: "A note says something", message: "A note says nothing.", subjectId: subject.id, nodeIds: [subject.id], repairs: [] }] : [],
});

const policy: Policy = {
  roles: ["writer", "planner", "reader"],
  grants: [
    { roles: ["writer"], mutations: ["jot", "rename-note", "finish-note"] },
    { roles: ["planner"], mutations: "*" },
  ],
  sees: [
    { roles: ["writer"], kinds: ["note"], own: true },
    { roles: ["planner", "reader"], kinds: ["note", "person"] },
  ],
};
const declaration = {
  schema,
  mutations: [jot, rename, finish, tear],
  invariants: [named],
  policy,
  intelligence: [{ name: "starter", kind: "graph" as const, description: "Seeds.", may: ["jot"] }],
};
const AT = "2026-10-04T09:00:00.000Z";

const ada: Principal = { kind: "human", id: "person:ada", roles: ["writer"] };
const bo: Principal = { kind: "human", id: "person:bo", roles: ["writer"] };
const cy: Principal = { kind: "human", id: "person:cy", roles: ["planner"] };
const di: Principal = { kind: "human", id: "person:di", roles: ["reader"] };
const starter: Principal = { kind: "agent", id: "starter", roles: ["planner"] };
const system: Principal = { kind: "system", id: "host" };

/** A store with history: Ada's note and Bo's, each made by its writer, and Bo's finished. */
const aStore = () => {
  const store = new Store({ ...declaration, now: () => AT });
  store.apply({ name: "jot", args: { id: "note:ada", label: "Call the florist" } }, { author: ada });
  store.apply({ name: "jot", args: { id: "note:bo", label: "Book the van" } }, { author: bo });
  store.apply({ name: "finish-note", args: { id: "note:bo" } }, { author: bo });
  return store;
};
/** The same store again, from its graph and its log: what the apply runs on. */
const copyOf = (store: Store<typeof schema>) => new Store({ ...declaration, now: () => AT, log: store.log.all(), snapshot: store.snapshot() });

const principals: readonly (Principal | undefined)[] = [undefined, ada, bo, cy, di, starter, system];
const batches: readonly (readonly MutationCall[])[] = [
  [{ name: "jot", args: { id: "note:new", label: "Order the cake" } }],
  // A record the batch made is its maker's own for the next call: sight read off the log as it goes.
  [{ name: "jot", args: { id: "note:new", label: "Order the cake" } }, { name: "rename-note", args: { id: "note:new", label: "Order two cakes" } }],
  [{ name: "rename-note", args: { id: "note:ada", label: "Call the florist again" } }],
  [{ name: "rename-note", args: { id: "note:bo", label: "Book a bigger van" } }],
  [{ name: "rename-note", args: { id: "note:ada", label: "forbidden" } }],
  [{ name: "rename-note", args: { id: "note:ada", label: " " } }],
  [{ name: "finish-note", args: { id: "note:bo" } }],
  [{ name: "finish-note", args: { id: "note:ada" } }, { name: "tear-note", args: { id: "note:bo" } }],
  [{ name: "tear-note", args: { id: "note:ada" } }],
  [{ name: "jot", args: { id: "note:new", label: "Twice" } }, { name: "rename-note", args: { id: "note:nowhere", label: "Lost" } }],
  [{ name: "dance", args: {} }],
  [{ name: "jot", args: { id: 7 } }],
];
const OVER = new Error("That would remove a record.");
const admits: readonly (ApplyOptions["admit"] | undefined)[] = [
  undefined,
  () => undefined,
  (planned: PlannedChange) => {
    if (planned.removed.nodes > 0) throw OVER;
  },
  () => {
    throw new Error("Nothing is admitted today.");
  },
];

type Outcome = { readonly threw: string } | { readonly ops: readonly unknown[]; readonly rest: unknown };
const outcomeOf = (run: () => { readonly ops: readonly Operation[] } & Record<string, unknown>): Outcome => {
  try {
    const { ops, batch: _batch, kept: _kept, ...rest } = run();
    // What is the same whether kept or not: everything but the op's id and batch.
    return { ops: ops.map(({ id: _id, batch: _b, ...op }) => op), rest };
  } catch (error) {
    return { threw: `${(error as Error).constructor.name}: ${(error as Error).message}` };
  }
};

describe("a preview is judged as its batch would be (FR-56)", () => {
  it("refuses exactly when applyAll on a fresh copy would, and otherwise says what it would keep", () => {
    let compared = 0;
    let refused = 0;
    for (const author of principals) {
      for (const calls of batches) {
        for (const admit of admits) {
          const options: ApplyOptions = { ...(author ? { author } : {}), via: "mcp:test", ...(admit ? { admit } : {}) };
          const store = aStore();
          const preview = outcomeOf(() => store.previewAll(calls, options) as never);
          const applied = outcomeOf(() => copyOf(store).applyAll(calls, options) as never);
          expect(preview, `${author?.id ?? "anyone"} · ${calls.map((call) => call.name).join(", ")} · admit ${admits.indexOf(admit)}`).toEqual(applied);
          compared++;
          if ("threw" in preview) refused++;
        }
      }
    }
    // Both answers were met many times over: a comparison that only ever refused proves little.
    expect(compared).toBe(principals.length * batches.length * admits.length);
    expect(refused).toBeGreaterThan(compared / 5);
    expect(compared - refused).toBeGreaterThan(compared / 5);
  });

  it("says the ops as they would be logged, marked as not kept, with the problems after", () => {
    const store = aStore();
    const length = store.log.length;
    const preview = store.previewAll(
      [
        { name: "jot", args: { id: "note:new", label: "Order the cake" } },
        { name: "rename-note", args: { id: "note:new", label: " " } },
      ],
      { author: ada, via: "mcp:test", intent: "Plan the party" },
    );
    expect(preview.kept).toBe(false);
    expect(preview.batch).toBe("preview");
    expect(preview.ops.map((op) => [op.id, op.seq, op.batch])).toEqual([
      ["preview:1", length, "preview"],
      ["preview:2", length + 1, "preview"],
    ]);
    expect(preview.ops.map((op) => [op.author, op.via, op.batchIntent, op.intent])).toEqual([
      // An act with no `describe` of its own is said in the gesture's words, as the log would say it.
      [ada, "mcp:test", "Plan the party", "Plan the party"],
      [ada, "mcp:test", "Plan the party", "Plan the party"],
    ]);
    expect(preview.violationsAfter.map((v) => v.subjectId)).toEqual(["note:new"]);
    expect(preview.introduces.map((v) => v.subjectId)).toEqual(["note:new"]);
    // The apply mints its own ids and batch; everything else is what the preview said.
    const applied = copyOf(store).applyAll(
      [
        { name: "jot", args: { id: "note:new", label: "Order the cake" } },
        { name: "rename-note", args: { id: "note:new", label: " " } },
      ],
      { author: ada, via: "mcp:test", intent: "Plan the party" },
    );
    expect(preview.ops.map(({ id: _id, batch: _batch, ...op }) => op)).toEqual(applied.ops.map(({ id: _id, batch: _batch, ...op }) => op));
  });

  it("joins the batch it is given, as the apply would, and still keeps nothing", () => {
    const store = aStore();
    const preview = store.previewAll([{ name: "jot", args: { id: "note:new", label: "Cake" } }], { author: ada, batch: "batch:client:4" });
    expect(preview.batch).toBe("batch:client:4");
    expect(preview.ops[0]!.batch).toBe("batch:client:4");
    expect(preview.ops[0]!.id).toBe("preview:1");
    expect(store.log.all().some((op) => op.batch === "batch:client:4")).toBe(false);
  });

  it("asks admit with the change as planned, and its refusal goes on up", () => {
    const store = aStore();
    const asked: PlannedChange[] = [];
    store.previewAll([{ name: "jot", args: { id: "note:new", label: "Cake" } }], { author: cy, admit: (planned) => void asked.push(planned) });
    expect(asked).toHaveLength(1);
    expect(asked[0]).toMatchObject({ added: { nodes: 1, edges: 0 }, nodesAfter: 3 });
    expect(asked[0]!.ops.map((op) => op.id)).toEqual(["preview:1"]);
    expect(() => store.previewAll([{ name: "tear-note", args: { id: "note:bo" } }], { author: cy, admit: admits[2] })).toThrow(OVER);
  });
});

describe("a preview writes, logs and tells nothing (FR-56)", () => {
  afterEach(() => {
    delete (globalThis as { __graviewWatch?: unknown }).__graviewWatch;
  });

  const watch = () => {
    const told: unknown[] = [];
    (globalThis as { __graviewWatch?: unknown }).__graviewWatch = {
      store: (store: unknown) => told.push(["store", store]),
      learn: (learned: unknown) => told.push(["learn", learned]),
      refused: (refusal: unknown) => told.push(["refused", refusal]),
    };
    return told;
  };

  const kept = (store: Store<typeof schema>) => JSON.stringify({ graph: store.snapshot(), log: store.log.all(), epochs: store.log.epochs(), batches: store.batches() });

  for (const [said, author, calls] of [
    ["one that would be kept", cy, [{ name: "jot", args: { id: "note:new", label: "Cake" } }, { name: "tear-note", args: { id: "note:bo" } }]],
    ["one the policy refuses", di, [{ name: "jot", args: { id: "note:new", label: "Cake" } }]],
    ["one refused part way", ada, [{ name: "jot", args: { id: "note:new", label: "Cake" } }, { name: "rename-note", args: { id: "note:bo", label: "Mine now" } }]],
  ] as const) {
    it(`leaves the graph, the log, the subscribers and the watch as they were, for ${said}`, () => {
      const store = aStore();
      const before = kept(store);
      const heard: unknown[] = [];
      store.subscribe((diff, ops) => heard.push({ diff, ops }));
      store.graph.subscribe((diff) => heard.push({ graph: diff }));
      const told = watch();
      try {
        store.previewAll(calls, { author, via: "mcp:test", admit: () => undefined });
      } catch {
        // Refused or not, it is the same store afterwards.
      }
      expect(kept(store)).toBe(before);
      expect(heard).toEqual([]);
      expect(told).toEqual([]);
    });
  }

  it("mints nothing the next apply would have minted", () => {
    const store = aStore();
    const twin = aStore();
    store.previewAll([{ name: "jot", args: { id: "note:new", label: "Cake" } }], { author: cy });
    const next = store.apply({ name: "jot", args: { id: "note:new", label: "Cake" } }, { author: cy });
    const expected = twin.apply({ name: "jot", args: { id: "note:new", label: "Cake" } }, { author: cy });
    expect(next.ops[0]!.id).toBe(expected.ops[0]!.id);
    expect(next.batch.split(":").at(-1)).toBe(expected.batch.split(":").at(-1));
  });
});
