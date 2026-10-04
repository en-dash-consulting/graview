import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createSchema, defineNode, isWithheld, logSeenBy, OperationLog, Store, type AnySchema, type Principal } from "../../src/index.js";
import { leaked, oracle, SCHEMA, storeOf, unseenIds, world } from "../support/unseen-worlds.js";

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
});
