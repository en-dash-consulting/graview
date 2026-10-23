import { bindSchema, createSchema, defineNode, nodeRef, Store, type AnySchema, type Policy, type Principal } from "@graview/core";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { llmResponder, seatResponder, turnThroughMessages, type MessagesStepRequest } from "../../src/index.js";
import { READ_AS_ANY_AGENT } from "../../src/seat-model.js";

/**
 * A RESPONDER HANDED THE WHOLE STORE SAYS ONLY WHAT ITS SEAT SEES. The
 * chat hands its responder the provider's store, already narrowed to the
 * seat; a host calling `llmResponder` or `seatResponder` directly hands
 * the store itself, and the system prompt listed every kind's names, the
 * links between them, the broken rules, the selection and the graph's
 * first reading, whoever was asking. Now the prompt is written over
 * `seenBy(principal)`; with no principal, over what any agent sees, and
 * the answer says so.
 */
const vendor = defineNode("vendor", {
  fields: z.object({ label: z.string(), paid: z.boolean() }),
  edges: { pays: { to: ["payroll"], description: "who it pays" } },
  plural: "Vendors",
});
const payroll = defineNode("payroll", { fields: z.object({ label: z.string(), salary: z.number() }), plural: "Payroll" });
const schema = createSchema([vendor, payroll]);
const { defineMutation, defineInvariant } = bindSchema(schema);
const raise = defineMutation("give-raise", {
  title: "Give a raise",
  subject: { kinds: ["payroll"], arg: "id" },
  input: z.object({ id: nodeRef(["payroll"]) }),
  apply(ctx, args) {
    ctx.patchNode(args.id, { salary: 1 });
  },
});
const underpaid = defineInvariant("underpaid", {
  scope: { kind: "payroll" },
  description: "Every salary is fair.",
  repairs: ["give-raise"],
  evaluate: ({ subject }) =>
    subject.salary < 100
      ? [{ invariant: "underpaid", subjectId: subject.id, label: "Underpaid", message: `${subject.label} is underpaid.`, nodeIds: [subject.id], repairs: [{ mutation: "give-raise", args: { id: subject.id }, label: "Give a raise" }] }]
      : [],
});
const policy: Policy = {
  grants: [{ roles: ["planner"], mutations: "*" }, { roles: ["owner"], mutations: "*" }],
  sees: [
    { roles: ["planner"], kinds: ["vendor"] },
    { roles: ["owner"], kinds: ["vendor", "payroll"] },
  ],
};
const planner: Principal = { kind: "agent", id: "chat", roles: ["planner"] };
const HIDDEN = "Hidden Hopper";

function office() {
  return new Store({
    schema,
    mutations: [raise],
    invariants: [underpaid],
    policy,
    snapshot: {
      nodes: [
        { id: "vendor:florist", kind: "vendor", label: "Bloom & Co", paid: false },
        { id: "payroll:hopper", kind: "payroll", label: HIDDEN, salary: 10 },
      ] as never,
      edges: [{ kind: "pays", from: "vendor:florist", to: "payroll:hopper" }] as never,
    },
  }) as unknown as Store<AnySchema>;
}

/** Everything a model was handed, as one string: the system and every message of every step. */
function watched() {
  const handed: string[] = [];
  const turn = turnThroughMessages(async (request: MessagesStepRequest) => {
    handed.push(JSON.stringify(request));
    return { content: [{ type: "text", text: '{"say": "Noted.", "proposals": []}' }], stop_reason: "end_turn" };
  });
  return { turn, handed };
}

/** The ask, its selection and a first reading all point at the hidden record, as a careless host would hand them. */
const pointed = { selection: ["payroll:hopper", "vendor:florist"], reading: [{ mutation: "give-raise", args: { id: "payroll:hopper" }, why: "underpaid" }] };

describe("a responder called directly with the whole store", () => {
  it("writes the turn's system over what the planner sees: the vendor is named, the hidden record by no name, id or rule", async () => {
    const { turn, handed } = watched();
    await llmResponder<AnySchema>({ turn })(office(), "what needs doing?", { principal: planner, ...pointed });
    const said = handed.join("\n");
    expect(said).toContain("Bloom & Co");
    expect(said).not.toContain(HIDDEN);
    expect(said).not.toContain("payroll:hopper");
  });

  it("writes a completion's prompt the same way, through seatResponder", async () => {
    let prompt = "";
    await seatResponder<AnySchema>({ complete: async ({ prompt: asked }) => ((prompt = asked), { text: '{"say": "Noted.", "proposals": []}' }) })(office(), "how should we plan the next quarter?", { principal: planner });
    expect(prompt).toContain("Bloom & Co");
    expect(prompt).not.toContain(HIDDEN);
    expect(prompt).not.toContain("payroll:hopper");
  });

  it("answers from the graph as the planner too: the selected vendor's links name no hidden record", async () => {
    const reply = await seatResponder<AnySchema>({ complete: async () => ({ text: '{"say": "Noted.", "proposals": []}' }) })(office(), "tell me about Bloom & Co", { principal: planner });
    expect(reply.say).toContain("Bloom & Co");
    expect(reply.say).not.toContain(HIDDEN);
  });

  it("still names it to the seat that may see it", async () => {
    let prompt = "";
    await llmResponder<AnySchema>({ complete: async ({ prompt: asked }) => ((prompt = asked), { text: '{"say": "Noted.", "proposals": []}' }) })(office(), "what needs doing?", { principal: { kind: "human", id: "boss", roles: ["owner"] } });
    expect(prompt).toContain(HIDDEN);
  });

  it("asked with no seat, reads as any agent rather than as the whole graph, and says so", async () => {
    const { turn, handed } = watched();
    const reply = await llmResponder<AnySchema>({ turn })(office(), "what needs doing?", pointed);
    const said = handed.join("\n");
    expect(said).not.toContain(HIDDEN);
    expect(said).not.toContain("Bloom & Co");
    expect(reply.say).toBe(`Noted. ${READ_AS_ANY_AGENT}`);
  });

  it("asked with no seat of a store that keeps nothing from anybody, says nothing extra", async () => {
    const open = new Store({ schema, mutations: [raise], snapshot: { nodes: [{ id: "payroll:hopper", kind: "payroll", label: HIDDEN, salary: 500 }] as never, edges: [] } }) as unknown as Store<AnySchema>;
    let prompt = "";
    const reply = await llmResponder<AnySchema>({ complete: async ({ prompt: asked }) => ((prompt = asked), { text: '{"say": "Noted.", "proposals": []}' }) })(open, "who works here?");
    expect(prompt).toContain(HIDDEN);
    expect(reply.say).toBe("Noted.");
  });
});
