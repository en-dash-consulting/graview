import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createSchema, defineNode, isWithheld, logSeenBy, OperationLog, Store, type AnySchema, type Primitive, type Principal } from "../../src/index.js";
import { canonical, fold, leaked, oracle, rng, SCHEMA, schemaOf, storeAt, storeOf, unseenIds, world } from "../support/unseen-worlds.js";

/**
 * A SEAT IS NEVER SERVED AN ID IT MAY NOT SEE (FR-55).
 *
 * `seenBy` and `logSeenBy` dropped the records a seat may not see and left
 * their ids wherever else they stood: in a seen record's field (`ref:
 * "secret:s1"`) and in a withheld op's primitives. An id is minted from a
 * label, so it told the seat the hidden record's name. The property, from
 * Graview Cloud's room: for any graph, history, sights and seat, no string
 * that is an unseen record's id appears anywhere in what the seat is served
 * — and every record it may see still is, fitting its own declaration.
 */
const WORLDS = 1000;

describe("a seat is never served an id it may not see", () => {
  it("serves the hidden record's id nowhere: Cloud's reproduction", () => {
    const pub = defineNode("pub", { fields: z.object({ title: z.string(), ref: z.string().optional() }) });
    const secret = defineNode("secret", { fields: z.object({ title: z.string() }) });
    const schema = createSchema([pub, secret]) as unknown as AnySchema;
    const store = new Store<AnySchema>({
      schema,
      policy: { grants: [], sees: [{ roles: ["viewer"], kinds: ["pub"] }] },
      snapshot: {
        nodes: [
          { id: "pub:p1", kind: "pub", title: "P", ref: "secret:s1" },
          { id: "secret:s1", kind: "secret", title: "S" },
        ],
        edges: [],
      },
      log: [
        {
          id: "op1",
          seq: 0,
          batch: "b1",
          author: { kind: "human", id: "u1" },
          intent: "Point P at S",
          mutation: null,
          primitives: [{ op: "patch-node", id: "pub:p1", before: { ref: "\u0000graview:unset" }, after: { ref: "secret:s1" } }],
          inverse: [],
          reads: [],
          writes: ["pub:p1"],
          at: "2026-10-02T00:00:00.000Z",
        },
      ],
    });
    const viewer: Principal = { kind: "human", id: "u2", roles: ["viewer"] };
    const seen = store.seenBy(viewer);
    const served = JSON.stringify({ snapshot: seen.snapshot(), log: logSeenBy(store, viewer) });
    expect(served).not.toContain("secret:s1");
    // The record stays, without the field that named what the seat may not see.
    expect(seen.snapshot().nodes).toEqual([{ id: "pub:p1", kind: "pub", title: "P" }]);
    expect(seen.graph.getNode("pub:p1")).toEqual({ id: "pub:p1", kind: "pub", title: "P" });
    // The op is withheld, and the change it made reaches the seat as the field cleared.
    const [op] = logSeenBy(store, viewer);
    expect(isWithheld(op!)).toBe(true);
    expect(op!.primitives).toEqual([{ op: "patch-node", id: "pub:p1", before: { ref: "\u0000graview:unset" }, after: { ref: "\u0000graview:unset" } }]);
  });

  it("withholds a record whose REQUIRED field names one the seat may not see, rather than serve it misfitting", () => {
    const pub = defineNode("pub", { fields: z.object({ title: z.string(), ref: z.string() }), edges: { rel: { to: ["pub"], cardinality: "many" } } });
    const secret = defineNode("secret", { fields: z.object({ title: z.string() }) });
    const store = new Store<AnySchema>({
      schema: createSchema([pub, secret]) as unknown as AnySchema,
      policy: { grants: [], sees: [{ roles: ["viewer"], kinds: ["pub"] }] },
      snapshot: {
        nodes: [
          { id: "pub:p1", kind: "pub", title: "P", ref: "secret:s1" },
          { id: "pub:p2", kind: "pub", title: "Q", ref: "pub:p1" },
          { id: "secret:s1", kind: "secret", title: "S" },
        ],
        edges: [{ kind: "rel", from: "pub:p1", to: "pub:p2" }],
      },
    });
    const seen = store.seenBy({ kind: "human", id: "u2", roles: ["viewer"] });
    expect(seen.snapshot()).toEqual({ nodes: [{ id: "pub:p2", kind: "pub", title: "Q", ref: "pub:p1" }], edges: [] });
    expect(seen.graph.getNode("pub:p1")).toBeUndefined();
    expect(seen.graph.has("pub:p1")).toBe(false);
  });

  it(`never lets an unseen id out of seenBy or logSeenBy, and never loses a seen record — ${WORLDS.toLocaleString("en")} random worlds`, () => {
    let withheld = 0;
    let hidden = 0;
    let cleared = 0;
    for (let seed = 1; seed <= WORLDS; seed++) {
      const w = world(seed);
      const store = storeOf(w);
      const seen = store.seenBy(w.viewer);
      const unseen = unseenIds(w);

      const snapshot = seen.snapshot();
      const log = logSeenBy(store, w.viewer);
      const payloads = {
        snapshot,
        log,
        viewLog: seen.log.all(),
        batches: seen.batches(),
        nodes: seen.graph.allNodes(),
        edges: seen.graph.allEdges(),
        each: [...w.kindOf.keys()].map((id) => [seen.graph.getNode(id) ?? null, seen.graph.out(id), seen.graph.in(id), seen.graph.outEdges(id), seen.graph.inEdges(id)]),
        violations: seen.violations(),
      };
      for (const [name, payload] of Object.entries(payloads)) {
        const id = leaked(payload, unseen);
        expect(id, `seed ${seed}: ${name} names unseen ${id}: ${JSON.stringify(payload).slice(0, 400)}`).toBeUndefined();
      }

      // Nothing seen is lost: a seen record is there unless a field it cannot do without names an unseen one.
      const shown = new Map(snapshot.nodes.map((node) => [node.id, node]));
      for (const node of w.nodes) {
        if (!oracle(w, node.id)) continue;
        const names = typeof node["ref"] === "string" && w.kindOf.has(node["ref"]) && !oracle(w, node["ref"]);
        if (names && node.kind === "d") {
          expect(shown.has(node.id), `seed ${seed}: served ${node.id}, whose required ref names an unseen record`).toBe(false);
          continue;
        }
        expect(shown.get(node.id), `seed ${seed}: lost ${node.id}`).toEqual(names ? Object.fromEntries(Object.entries(node).filter(([key]) => key !== "ref")) : node);
        if (names) cleared++;
      }
      // Everything served fits its own declaration, so a client loads it.
      for (const node of snapshot.nodes) expect(() => SCHEMA.parseNode(node), `seed ${seed}: ${node.id} misfits`).not.toThrow();
      for (const edge of w.edges) if (shown.has(edge.from) && shown.has(edge.to)) expect(snapshot.edges).toContainEqual(edge);
      // The log keeps its numbering, so an OperationLog takes it.
      expect(log.map((op) => op.seq)).toEqual(w.ops.map((op) => op.seq));
      expect(() => OperationLog.from(log)).not.toThrow();
      withheld += log.filter(isWithheld).length;
      hidden += w.nodes.length - snapshot.nodes.length;
    }
    // The generator really exercised the view.
    expect(withheld).toBeGreaterThan(1000);
    expect(hidden).toBeGreaterThan(1000);
    expect(cleared).toBeGreaterThan(100);
  }, 120_000);

  /*
   * WHAT A SEAT IS SERVED FOLDS (FR-55). A record withheld because a
   * required field names a hidden one comes and goes as that field moves,
   * and the log a seat is served has to say so: folding it from nothing
   * reaches the snapshot the seat is served, after every op — and folding
   * the ops after any moment onto what the seat was served at that moment
   * reaches what it is served now, as a client catching up from a cursor
   * does. The fold judges every write as a client does.
   */
  it("serves a record that comes and goes as its required field moves, in ops a client can fold", () => {
    const pub = defineNode("pub", { fields: z.object({ title: z.string(), ref: z.string() }), edges: { rel: { to: ["pub"], cardinality: "many" } } });
    const secret = defineNode("secret", { fields: z.object({ title: z.string() }) });
    const schema = createSchema([pub, secret]) as unknown as AnySchema;
    const store = new Store<AnySchema>({ schema, policy: { grants: [], sees: [{ roles: ["viewer"], kinds: ["pub"] }] } });
    const viewer: Principal = { kind: "human", id: "u2", roles: ["viewer"] };
    const p1 = { id: "pub:p1", kind: "pub", title: "P1", ref: "secret:s1" };
    const p2 = { id: "pub:p2", kind: "pub", title: "P2", ref: "pub:p2" };
    const steps: Primitive[][] = [
      // A record the seat may see, withheld because its required field names one it may not.
      [{ op: "add-node", node: { id: "secret:s1", kind: "secret", title: "S" } }, { op: "add-node", node: p1 }, { op: "add-node", node: p2 }, { op: "add-edge", edge: { kind: "rel", from: "pub:p1", to: "pub:p2" } }],
      // Its field points at a record the seat sees: it arrives, with its link.
      [{ op: "patch-node", id: "pub:p1", before: { ref: "secret:s1" }, after: { ref: "pub:p2" } }],
      // A seen record's required field points at the hidden one: it goes.
      [{ op: "patch-node", id: "pub:p2", before: { ref: "pub:p2" }, after: { ref: "secret:s1" } }],
      // The one that went is removed: nothing to say.
      [{ op: "remove-edge", edge: { kind: "rel", from: "pub:p1", to: "pub:p2" } }, { op: "remove-node", node: { ...p2, ref: "secret:s1" } }],
      // Pointed back at the hidden record, then removed: it goes, and its removal is nothing to say.
      [{ op: "patch-node", id: "pub:p1", before: { ref: "pub:p2" }, after: { ref: "secret:s1" } }],
      [{ op: "remove-node", node: p1 }],
    ];
    let had = { nodes: [], edges: [] } as ReturnType<typeof fold>;
    let seq = 0;
    const served: string[] = [];
    for (const primitives of steps) {
      store.applyPrimitives(primitives, { author: { kind: "human", id: "u1" } });
      const log = logSeenBy(store, viewer);
      const now = store.seenBy(viewer).snapshot();
      expect(canonical(fold(schema, log)), `after ${log.length} ops, from nothing`).toBe(canonical(now));
      had = fold(schema, log.slice(seq), had);
      expect(canonical(had), `after ${log.length} ops, caught up`).toBe(canonical(now));
      seq = log.length;
      served.push(now.nodes.map((node) => node.id).join(","));
      expect(JSON.stringify(log)).not.toContain("secret:s1");
    }
    expect(served).toEqual(["pub:p2", "pub:p1,pub:p2", "pub:p1", "pub:p1", "", ""]);
  });

  /*
   * NOT WITHHELD FOR WHAT IT ONLY READ. An op whose every primitive is about
   * records the seat is served, as it is served them, and whose only
   * mention of a hidden record is in what it read or wrote, is served whole
   * with those trimmed: what it did is the seat's to know, and only the name
   * of what it looked at is not. A call that names one stays withheld — an
   * act's sentence is made from its call.
   */
  it(`serves an op whole when the only hidden record it mentions is in its reads or writes — ${WORLDS.toLocaleString("en")} random worlds`, () => {
    let trimmed = 0;
    for (let seed = 1; seed <= WORLDS; seed++) {
      const w = world(seed);
      const store = storeOf(w);
      const unseen = unseenIds(w);
      const served = logSeenBy(store, w.viewer);
      served.forEach((op, at) => {
        const raw = w.ops[at]!;
        const rest = { ...raw, reads: [], writes: [] };
        if (!isWithheld(op) && leaked(raw, unseen) !== undefined) trimmed++;
        if (!isWithheld(op) || leaked(rest, unseen) !== undefined) return;
        expect(JSON.stringify(op.primitives), `seed ${seed}: ${op.id} withheld only for what it read or wrote`).not.toBe(JSON.stringify(raw.primitives));
      });
    }
    expect(trimmed).toBeGreaterThan(300);
  }, 120_000);

  it("serves an op that only read a hidden record whole, without naming it", () => {
    const pub = defineNode("pub", { fields: z.object({ title: z.string() }) });
    const secret = defineNode("secret", { fields: z.object({ title: z.string() }) });
    const store = new Store<AnySchema>({
      schema: createSchema([pub, secret]) as unknown as AnySchema,
      policy: { grants: [], sees: [{ roles: ["viewer"], kinds: ["pub"] }] },
      snapshot: { nodes: [{ id: "pub:p1", kind: "pub", title: "Q" }, { id: "secret:s1", kind: "secret", title: "S" }], edges: [] },
      log: [
        {
          id: "op1", seq: 0, batch: "b1", author: { kind: "human", id: "u1" }, intent: "Retitle P",
          mutation: { name: "retitle", args: { id: "pub:p1", title: "Q" } },
          primitives: [{ op: "patch-node", id: "pub:p1", before: { title: "P" }, after: { title: "Q" } }],
          inverse: [{ op: "patch-node", id: "pub:p1", before: { title: "Q" }, after: { title: "P" } }],
          reads: ["pub:p1", "secret:s1"], writes: ["pub:p1"], at: "2026-10-02T00:00:00.000Z",
        },
      ],
    });
    const [op] = logSeenBy(store, { kind: "human", id: "u2", roles: ["viewer"] });
    expect(isWithheld(op!)).toBe(false);
    expect(op).toMatchObject({ intent: "Retitle P", author: { id: "u1" }, reads: ["pub:p1"], writes: ["pub:p1"], mutation: { name: "retitle", args: { id: "pub:p1", title: "Q" } } });
    expect(JSON.stringify(op)).not.toContain("secret:s1");
  });

  it(`folds what a seat is served across acts, undo, a rebase and a compaction, from the epoch it is served — ${WORLDS.toLocaleString("en")} random worlds`, () => {
    const host: Principal = { kind: "system", id: "host" };
    let undone = 0;
    let compacted = 0;
    let rebased = 0;
    for (let seed = 1; seed <= WORLDS; seed++) {
      const w = world(seed, { required: seed % 2 === 0 });
      const schema = schemaOf(w);
      const s = storeAt(w, w.ops.length);
      const t = storeAt(w, w.ops.length);
      const r = rng(seed * 7919);
      const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(r() * xs.length)]!;

      const act = (store: Store<AnySchema>, batch?: string) => {
        const live = store.graph.allNodes().map((node) => node.id);
        const call = r() < 0.5 && live.length > 0 ? { name: "point", args: { id: pick(live), ref: w.anyId() } } : r() < 0.5 && live.length > 0 ? { name: "retitle", args: { id: pick(live), title: `R${seed}` } } : { name: "make", args: { title: `M${Math.floor(r() * 1e6)}`, ref: w.anyId() } };
        try {
          return store.applyAll([call], { author: host, ...(batch ? { batch } : {}) });
        } catch {
          return undefined;
        }
      };
      const check = (what: string) => {
        const view = s.seenBy(w.viewer);
        const base = [...view.log.epochs()].reverse().find((epoch) => epoch.seq <= s.log.horizon)?.base ?? { nodes: [], edges: [] };
        let folded: ReturnType<typeof fold>;
        try {
          folded = fold(schema, view.log.all(), base);
        } catch (error) {
          throw new Error(`seed ${seed}, ${what}: ${(error as Error).message}`);
        }
        expect(canonical(folded), `seed ${seed}, ${what}`).toBe(canonical(view.snapshot()));
        expect(leaked({ log: view.log.all(), epochs: view.log.epochs() }, unseenIds(w)), `seed ${seed}, ${what}`).toBeUndefined();
      };
      for (let round = 0; round < 8; round++) {
        if (r() < 0.3 && s.batches().length > 0) {
          try {
            s.undo([pick(s.batches()).id], { author: host });
            undone++;
          } catch {
            // A change something later depends on stays.
          }
          check(`after an undo in round ${round}`);
        } else {
          act(s);
          check(`after an act in round ${round}`);
        }
      }
      // Somebody else's ops land under one of ours still pending.
      const theirs = act(t);
      if (theirs && act(s, "pending:mine")) {
        s.rebase({ confirmed: theirs.ops, pending: ["pending:mine"] });
        rebased++;
        check("after a rebase");
      }

      const checkpoint = s.checkpoint({ seq: Math.max(1, s.log.length - 3) });
      if (checkpoint) {
        s.compact(checkpoint);
        compacted++;
        check("after a compaction");
        act(s);
        check("after an act past the horizon");
      }
    }
    expect(undone).toBeGreaterThan(WORLDS / 2);
    expect(rebased).toBeGreaterThan(WORLDS / 2);
    expect(compacted).toBeGreaterThan(WORLDS / 2);
  }, 300_000);

  for (const required of [false, true]) {
    it(`folds what a seat is served to what it is served, from nothing and from every cursor — ${WORLDS.toLocaleString("en")} random worlds, ${required ? "every" : "one kind's"} ref required`, () => {
      let folds = 0;
      let hiddenWhole = 0;
      for (let seed = 1; seed <= WORLDS; seed++) {
        const w = world(seed, { required });
        const schema = schemaOf(w);
        const snapshots = Array.from({ length: w.ops.length + 1 }, (_, count) => storeAt(w, count).seenBy(w.viewer).snapshot());
        const store = storeAt(w, w.ops.length);
        const log = logSeenBy(store, w.viewer);
        expect(canonical(store.seenBy(w.viewer).snapshot())).toBe(canonical(snapshots[w.ops.length]!));
        for (let count = 0; count <= w.ops.length; count++) {
          const at = `seed ${seed}, ${count} of ${w.ops.length} ops`;
          let fromNothing: ReturnType<typeof fold>;
          let caughtUp: ReturnType<typeof fold>;
          try {
            fromNothing = fold(schema, logSeenBy(storeAt(w, count), w.viewer));
            caughtUp = fold(schema, log.slice(count), snapshots[count]);
          } catch (error) {
            throw new Error(`${at}: ${(error as Error).message}`);
          }
          expect(canonical(fromNothing), `${at}, from nothing`).toBe(canonical(snapshots[count]!));
          expect(canonical(caughtUp), `${at}, caught up from there`).toBe(canonical(snapshots[w.ops.length]!));
          folds += 2;
        }
        const shown = new Set(snapshots[w.ops.length]!.nodes.map((node) => node.id));
        hiddenWhole += w.nodes.filter((node) => oracle(w, node.id) && !shown.has(node.id)).length;
      }
      expect(folds).toBeGreaterThan(WORLDS * 20);
      // The generator really withheld seen records whole for a required field.
      expect(hiddenWhole).toBeGreaterThan(required ? 500 : 100);
    }, 300_000);
  }
});
