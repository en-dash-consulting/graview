import { bindSchema, createSchema, defineNode, nodeRef, Store } from "@graview/core";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { deriveAffordances } from "../../src/derive.js";
import { usageBoost, usageWeights } from "../../src/usage.js";

/**
 * The menu scales: pins and use shuffle the ranking WITHIN its bands, and
 * the bands do not move. Repairs first, destructive last, whatever anyone
 * pins and however often anything ran.
 */

const thing = defineNode("thing", {
  fields: z.object({ label: z.string(), done: z.boolean() }),
  plural: "Things",
});
const schema = createSchema([thing]);
const bound = bindSchema(schema);

const plain = (name: string, extras: Record<string, unknown> = {}) =>
  bound.defineMutation(name, {
    title: `Act ${name}`,
    description: `Does ${name}.`,
    subject: { kinds: ["thing"], arg: "id" },
    input: z.object({ id: nodeRef(["thing"]) }),
    apply(ctx, args) {
      ctx.patchNode(args.id, { done: true });
    },
    ...extras,
  });

const alpha = plain("alpha");
const beta = plain("beta");
const delta = plain("delta");
const gamma = plain("gamma", { pinned: true });
const drop = plain("drop", { destructive: true });

const fix = bound.defineInvariant("fix-things", {
  scope: { kind: "thing" },
  description: "A thing must be done.",
  repairs: ["alpha"],
  evaluate({ graph }) {
    return graph
      .allNodes()
      .filter((node) => node.done === false)
      .map((node) => ({
        invariant: "fix-things",
        subjectId: node.id,
        label: "Fix it",
        message: `${node.label} is not done`,
        nodeIds: [node.id],
        repairs: [{ mutation: "alpha", args: { id: node.id }, label: "Do it" }],
      }));
  },
});

describe("usage weights from the op log", () => {
  it("is deterministic, counts frequency, and decays with distance", () => {
    const ops = (names: string[]) =>
      names.map((name, index) => ({
        id: `op-${index}`,
        seq: index,
        batch: `b-${index}`,
        author: { kind: "human" as const, id: "t" },
        intent: name,
        mutation: { name, args: {} },
        primitives: [],
        inverse: [],
        reads: [],
        writes: [],
        at: "2026-01-01T00:00:00Z",
      }));
    const recent = usageWeights(ops(["alpha", "beta", "beta"]));
    expect(recent.get("beta")!).toBeGreaterThan(recent.get("alpha")!);
    // Same log, same answer — no clock, no randomness.
    expect(usageWeights(ops(["alpha", "beta", "beta"]))).toEqual(recent);
    // An old use weighs less than a recent one of the same act.
    const spread = usageWeights(ops(["gamma", ...Array(200).fill("alpha"), "beta"]));
    expect(spread.get("beta")!).toBeGreaterThan(spread.get("gamma")!);
  });

  it("bounds the boost inside a band", () => {
    expect(usageBoost(0)).toBe(0);
    expect(usageBoost(1000)).toBeLessThan(8);
    expect(usageBoost(3)).toBeGreaterThan(usageBoost(1));
  });
});

describe("pins and bands", () => {
  const select = (store: Store<typeof schema>, options = {}) =>
    deriveAffordances(store, ["t1"], options).affordances.map((a) => a.mutation);

  const withThing = () => {
    const store = new Store({
      schema,
      mutations: [alpha, beta, delta, gamma, drop],
      invariants: [fix],
      log: [
        {
          id: "op-0",
          seq: 0,
          batch: "b-0",
          author: { kind: "human", id: "seed" },
          intent: "seed",
          mutation: null,
          primitives: [
            { op: "add-node", node: { id: "t1", kind: "thing", label: "One", done: false } },
          ],
          inverse: [{ op: "remove-node", id: "t1" }],
          reads: [],
          writes: ["t1"],
          at: "2026-01-01T00:00:00Z",
        },
      ],
    });
    return store;
  };

  it("keeps repairs first and destructive last, with the declared pin between", () => {
    const order = select(withThing());
    // The repair (alpha, via the invariant) leads; the destructive act ends.
    expect(order[0]).toBe("alpha");
    expect(order[order.length - 1]).toBe("drop");
    // The declared pin ranks above its unpinned peer.
    expect(order.indexOf("gamma")).toBeLessThan(order.indexOf("beta"));
  });

  it("lets a person's pin outrank the dev's, without crossing a band", () => {
    const order = select(withThing(), { pins: ["beta"] });
    expect(order[0]).toBe("alpha"); // repairs still first
    expect(order[order.length - 1]).toBe("drop"); // destructive still last
    // User pin (beta) above dev pin (gamma), both above nothing pinned.
    expect(order.indexOf("beta")).toBeLessThan(order.indexOf("gamma"));
  });

  it("marks pinned affordances so the interface can hold them in a head-section", () => {
    const derived = deriveAffordances(withThing(), ["t1"], { pins: ["beta"] });
    const byName = new Map(derived.affordances.map((a) => [a.mutation, a.pinned]));
    expect(byName.get("beta")).toBe("user");
    expect(byName.get("gamma")).toBe("declared");
    expect(byName.get("drop")).toBeUndefined();
  });

  it("ranks what the workspace actually uses ahead of what it never touches", () => {
    const store = withThing();
    // Untouched, beta and delta tie on score and fall back to id order.
    expect(select(store).indexOf("beta")).toBeLessThan(select(store).indexOf("delta"));
    // Use delta, and it overtakes its untouched peer — deterministically,
    // from the log alone.
    for (let i = 0; i < 5; i++) {
      store.apply({ name: "delta", args: { id: "t1" } }, { intent: "use it" });
    }
    const order = select(store);
    expect(order.indexOf("delta")).toBeLessThan(order.indexOf("beta"));
    // Inside its band only: the rule is satisfied now (delta marked the
    // thing done), so the pin leads — and heavy use never overtakes it.
    expect(order[0]).toBe("gamma");
    // And heavy use cannot buy the destructive act off the tail.
    for (let i = 0; i < 20; i++) {
      store.apply({ name: "drop", args: { id: "t1" } }, { intent: "spam" });
    }
    const after = select(store);
    expect(after[after.length - 1]).toBe("drop");
  });
});
