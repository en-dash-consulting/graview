import { bindSchema, createSchema, defineNode, nodeRef, Store } from "@graview/core";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { applyAffordance, deriveAffordances } from "../../src/index.js";

/**
 * THE LOG SAYS WHAT HAPPENED, NOT WHAT THE BUTTON SAID.
 *
 * The strip applied every affordance with the button's label as the op's
 * intent, so the history read "Hand it to someone" where the routed face —
 * applying the same act through its form — wrote the act's own `describe`:
 * "Pay the deposit is handled by Ada Nowak". One act, two sentences, and for
 * a repair answered through an ask the strip's sentence was the QUESTION:
 * "Hand Pay the deposit to somebody", after Ada had been chosen.
 */
const item = defineNode("item", {
  fields: z.object({ label: z.string(), status: z.enum(["open", "closed"]) }),
  plural: "Items",
  edges: { "handled-by": { to: ["person"], description: "who is seeing to it", inverse: "what they are seeing to" } },
});
const person = defineNode("person", { fields: z.object({ label: z.string() }), plural: "People" });
const schema = createSchema([item, person]);
const { defineMutation, defineInvariant } = bindSchema(schema);
const hand = defineMutation("hand-item", {
  title: "Hand it to someone",
  description: "Say who is seeing to an item.",
  subject: { kinds: ["item"], arg: "id" },
  connects: ["handled-by"],
  input: z.object({ id: nodeRef(["item"]), handler: nodeRef(["person"]) }),
  describe: (args, graph) =>
    `${(graph.getNode(args.id) as { label: string }).label} is handled by ${(graph.getNode(args.handler) as { label: string }).label}`,
  apply(ctx, args) {
    ctx.addEdge({ kind: "handled-by", from: args.id, to: args.handler });
  },
});
const close = defineMutation("close-item", {
  title: "Close it",
  description: "Mark an item closed.",
  subject: { kinds: ["item"], arg: "id" },
  writes: ["status"],
  input: z.object({ id: nodeRef(["item"]) }),
  apply(ctx, args) {
    ctx.patchNode(args.id, { status: "closed" });
  },
});
const handled = defineInvariant("every-item-handled", {
  scope: { kind: "item" },
  repairs: ["hand-item"],
  evaluate({ graph, subject }) {
    if (graph.out(subject.id, "handled-by").length > 0) return [];
    return [
      {
        invariant: "every-item-handled",
        subjectId: subject.id,
        label: subject.label,
        message: `${subject.label} is open and nobody is seeing to it`,
        nodeIds: [subject.id],
        repairs: [{ mutation: "hand-item", args: { id: subject.id }, missing: ["handler"], label: `Hand ${subject.label} to somebody` }],
      },
    ];
  },
});
const store = () =>
  new Store({
    schema,
    mutations: [hand, close],
    invariants: [handled],
    snapshot: {
      nodes: [
        { id: "deposit", kind: "item", label: "Pay the deposit", status: "open" },
        { id: "ada", kind: "person", label: "Ada Nowak" },
        { id: "bo", kind: "person", label: "Bo Lind" },
      ] as never,
      edges: [],
    },
  });

describe("what an act taken from the strip leaves in the history", () => {
  it("is the act's own sentence when it has one, the same as the routed face writes", () => {
    // Already handled by Ada, so the plain act (not the repair) is what the
    // strip offers, with Bo as its one candidate.
    const s = store();
    s.apply({ name: "hand-item", args: { id: "deposit", handler: "ada" } });
    const { affordances } = deriveAffordances(s, ["deposit"]);
    const offered = affordances.find((a) => a.mutation === "hand-item")!;
    expect(offered.id.startsWith("schema:")).toBe(true);
    applyAffordance(s, offered, { handler: "bo" });
    expect(s.log.all().at(-1)?.intent).toBe("Pay the deposit is handled by Bo Lind");
  });

  it("says the answer, not the question, when a repair was answered through an ask", () => {
    const s = store();
    const { affordances } = deriveAffordances(s, ["deposit"]);
    const repair = affordances.find((a) => a.id.startsWith("invariant:"))!;
    expect(repair.label).toBe("Hand Pay the deposit to somebody");
    applyAffordance(s, repair, { handler: "ada" });
    expect(s.log.all().at(-1)?.intent).toBe("Pay the deposit is handled by Ada Nowak");
  });

  it("falls back to the button's words for an act with none of its own", () => {
    const s = store();
    const { affordances } = deriveAffordances(s, ["deposit"]);
    const offered = affordances.find((a) => a.mutation === "close-item")!;
    applyAffordance(s, offered);
    expect(s.log.all().at(-1)?.intent).toBe("Close it");
  });
});
