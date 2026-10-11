import { bindSchema, createSchema, defineNode, nodeRef, Store, type AnySchema, type Policy, type Principal } from "@graview/core";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { aiThroughDevServer, llmResponder, seatResponder, turnThroughMessages, type HostTurn, type MessagesStepRequest } from "../../src/index.js";
import { TURN_CALLS } from "../../src/seat-model.js";

/**
 * THE SEAT READS BEFORE IT ANSWERS (FR-160). A host's AI used to be one
 * completion over one prompt — the acts, twelve names a kind, forty
 * connections — and no record's fields, so "which vendors are unpaid" was
 * answered "the prompt does not say". A host that hands the seat a `turn`
 * gets the same framing as its system, the conversation as messages, and
 * the seat's read tools as the person: its model reads, and its last text
 * is read exactly as a completion's is.
 */
const vendor = defineNode("vendor", {
  fields: z.object({ label: z.string(), amount: z.number(), paid: z.boolean() }),
  plural: "Vendors",
});
const payroll = defineNode("payroll", { fields: z.object({ label: z.string(), salary: z.number() }), plural: "Payroll" });
const schema = createSchema([vendor, payroll]);
const { defineMutation } = bindSchema(schema);
const markPaid = defineMutation("mark-paid", {
  title: "Mark paid",
  subject: { kinds: ["vendor"], arg: "id" },
  writes: ["paid"],
  input: z.object({ id: nodeRef(["vendor"]) }),
  apply(ctx, args) {
    ctx.patchNode(args.id, { paid: true });
  },
});
const policy: Policy = {
  grants: [{ roles: ["planner"], mutations: "*" }, { roles: ["owner"], mutations: "*" }],
  sees: [
    { roles: ["planner"], kinds: ["vendor"] },
    { roles: ["owner"], kinds: ["vendor", "payroll"] },
  ],
};
const planner: Principal = { kind: "agent", id: "chat", roles: ["planner"] };

function wedding() {
  return new Store({
    schema,
    mutations: [markPaid],
    policy,
    snapshot: {
      nodes: [
        { id: "vendor:florist", kind: "vendor", label: "Bloom & Co", amount: 1200, paid: false },
        { id: "vendor:caterer", kind: "vendor", label: "Feast Kitchen", amount: 5400, paid: true },
        { id: "vendor:band", kind: "vendor", label: "The Late Set", amount: 2000, paid: false },
        { id: "payroll:ada", kind: "payroll", label: "Ada Lovelace", salary: 90000 },
      ] as never,
      edges: [],
    },
  }) as unknown as Store<AnySchema>;
}

/** A host's model, scripted: it finds the vendors, reads each one, then answers from their fields. */
const reader = vi.fn(async (turn: HostTurn): Promise<string> => {
  const graph = (await turn.call("get_graph", {})) as { nodes: { id: string; kind: string }[] };
  const unpaid: { id: string; label: string; amount: number }[] = [];
  for (const hit of graph.nodes.filter((node) => node.kind === "vendor")) {
    const read = (await turn.call("get_node", { id: hit.id })) as { node: { id: string; label: { text?: string } | string; amount: number; paid: boolean } };
    const label = typeof read.node.label === "string" ? read.node.label : String(read.node.label.text);
    if (!read.node.paid) unpaid.push({ id: read.node.id, label, amount: read.node.amount });
  }
  return JSON.stringify({
    say: `Unpaid: ${unpaid.map((one) => `${one.label} (${one.amount})`).join(" and ")}.`,
    proposals: unpaid.map((one) => ({ mutation: "mark-paid", args: { id: one.label }, why: "It is unpaid." })),
  });
});

describe("a seat whose host hands it a turn", () => {
  it("answers what no prompt held — what is still owed, and to whom — from the records' fields, read through its own tools, and proposes through the same gate", async () => {
    const store = wedding();
    const reply = await seatResponder<AnySchema>({ name: "claude", turn: reader })(store, "how much do we still owe, and to whom?", { principal: planner });
    expect(reply.say).toBe("Unpaid: Bloom & Co (1200) and The Late Set (2000).");
    expect(reply.via).toBe("ai:claude");
    // Named as a person names them, resolved and validated as a completion's proposals are; nothing applied.
    expect(reply.proposals.map((one) => [one.mutation, one.args])).toEqual([
      ["mark-paid", { id: "vendor:florist" }],
      ["mark-paid", { id: "vendor:band" }],
    ]);
    expect((store.graph.getNode("vendor:florist") as unknown as { paid: boolean }).paid).toBe(false);
  });

  it("is handed the seat's framing, the read tools only, and the instruction to read before answering", async () => {
    let seen: HostTurn | undefined;
    await llmResponder<AnySchema>({ turn: async (turn) => ((seen = turn), '{"say": "ok", "proposals": []}') })(wedding(), "how much do we still owe, and to whom?", { principal: planner });
    expect(seen!.system).toContain("mark-paid(id: name of vendor)");
    expect(seen!.system).toContain("Read it with the tools");
    expect(seen!.system).toContain("Answer ONLY JSON");
    expect(seen!.system).not.toContain("Person:");
    const names = seen!.tools.map((tool) => tool.name);
    expect(names).toEqual(expect.arrayContaining(["search_graph", "get_node", "get_violations"]));
    expect(seen!.tools.every((tool) => !tool.mutating)).toBe(true);
    expect(names).not.toContain("mark-paid");
    expect(names).not.toContain("undo_batch");
  });

  it("refuses a write and a record the person may not see, and changes nothing", async () => {
    const store = wedding();
    const before = store.graph.getNode("vendor:florist");
    let refusals: unknown[] = [];
    await llmResponder<AnySchema>({
      turn: async (turn) => {
        refusals = await Promise.all([
          turn.call("mark-paid", { id: "vendor:florist" }),
          turn.call("undo_batch", { batch: "x" }),
          turn.call("get_node", { id: "payroll:ada" }),
          turn.call("get_node", { id: "Ada Lovelace" }),
        ]);
        return '{"say": "ok", "proposals": []}';
      },
    })(store, "pay the florist", { principal: planner });
    for (const refusal of refusals) expect(refusal).toEqual({ error: expect.any(String) });
    expect(JSON.stringify(refusals)).not.toContain("90000");
    expect(store.graph.getNode("vendor:florist")).toBe(before);
  });

  it("says, past the bound, to answer from what was read", async () => {
    const answers: unknown[] = [];
    await llmResponder<AnySchema>({
      turn: async (turn) => {
        for (let n = 0; n <= TURN_CALLS; n += 1) answers.push(await turn.call("get_node", { id: "vendor:florist" }));
        return '{"say": "ok", "proposals": []}';
      },
    })(wedding(), "what did we pay the florist?", { principal: planner });
    expect(answers.slice(0, TURN_CALLS).every((one) => !(one as { error?: string }).error)).toBe(true);
    expect(answers[TURN_CALLS]).toEqual({ error: expect.stringContaining("answer from what you have read") });
  });

  it("carries the selection and the conversation: the selection in the system, the history as alternating messages ending with the person's words", async () => {
    let seen: HostTurn | undefined;
    await llmResponder<AnySchema>({ turn: async (turn) => ((seen = turn), '{"say": "ok", "proposals": []}') })(wedding(), "what do we owe them?", {
      principal: planner,
      selection: ["vendor:florist"],
      history: [
        { role: "seat", text: "Hello." },
        { role: "person", text: "Who does the flowers?" },
        { role: "seat", text: "Bloom & Co." },
      ],
    });
    expect(seen!.system).toContain('Selected right now (what "this" means): vendor:florist (Bloom & Co)');
    expect(seen!.messages).toEqual([
      { role: "user", content: "Who does the flowers?" },
      { role: "assistant", content: "Bloom & Co." },
      { role: "user", content: "what do we owe them?" },
    ]);
  });

  it("is preferred to a completion when a host gives both, and a host with only a completion is asked as before", async () => {
    const complete = vi.fn(async (_prompt: string) => '{"say": "From the prompt.", "proposals": []}');
    const turn = vi.fn(async () => '{"say": "From the turn.", "proposals": []}');
    const both = await seatResponder<AnySchema>({ complete, turn })(wedding(), "how much do we still owe, and to whom?", { principal: planner });
    expect(both.say).toBe("From the turn.");
    expect(complete).not.toHaveBeenCalled();

    const only = await seatResponder<AnySchema>({ complete })(wedding(), "how much do we still owe, and to whom?", { principal: planner, history: [{ role: "person", text: "hi" }] });
    expect(only.say).toBe("From the prompt.");
    const prompt = complete.mock.calls[0]![0];
    expect(prompt).toContain("Conversation so far:\nPerson: hi");
    expect(prompt).toContain("Person: how much do we still owe, and to whom?");
    expect(prompt).not.toContain("Read it with the tools");
  });
});

describe("a turn over the Messages API", () => {
  it("runs the model's tool uses through the seat's call, hands the results back, and returns the last text", async () => {
    const sent: MessagesStepRequest[] = [];
    const step = vi.fn(async (request: MessagesStepRequest) => {
      sent.push(structuredClone(request) as MessagesStepRequest);
      return sent.length === 1
        ? { content: [{ type: "text", text: "Reading." }, { type: "tool_use", id: "t1", name: "get_node", input: { id: "Bloom & Co" } }], stop_reason: "tool_use" }
        : { content: [{ type: "text", text: '{"say": "We owe Bloom & Co 1200.", "proposals": []}' }], stop_reason: "end_turn" };
    });
    const reply = await seatResponder<AnySchema>({ turn: turnThroughMessages(step) })(wedding(), "what did we pay the florist?", { principal: planner });
    expect(reply.say).toBe("We owe Bloom & Co 1200.");
    expect(sent[0]!.tools!.map((tool) => tool.name)).toContain("get_node");
    expect(sent[0]!.tools![0]).toHaveProperty("input_schema");
    const result = (sent[1]!.messages[2]!.content as { type: string; tool_use_id: string; content: string }[])[0]!;
    expect(result).toMatchObject({ type: "tool_result", tool_use_id: "t1" });
    expect(JSON.parse(result.content).node).toMatchObject({ id: "vendor:florist", amount: 1200 });
  });

  it("takes at most its steps, the last offering no tool", async () => {
    const step = vi.fn(async (request: MessagesStepRequest) =>
      request.tool_choice ? { content: [{ type: "text", text: '{"say": "Enough.", "proposals": []}' }], stop_reason: "end_turn" } : { content: [{ type: "tool_use", id: "t", name: "get_violations", input: {} }], stop_reason: "tool_use" },
    );
    const reply = await seatResponder<AnySchema>({ turn: turnThroughMessages(step, { steps: 3 }) })(wedding(), "anything I should worry about?", { principal: planner });
    expect(reply.say).toBe("Enough.");
    expect(step).toHaveBeenCalledTimes(3);
    expect(step.mock.calls[2]![0].tool_choice).toEqual({ type: "none" });
  });

  it("sends no system at all when the turn has none, so a route that forwards it as it is is not refused an empty one", async () => {
    const step = vi.fn(async (_request: MessagesStepRequest) => ({ content: [{ type: "text", text: "Hello." }], stop_reason: "end_turn" }));
    await turnThroughMessages(step)({ system: "", messages: [{ role: "user", content: "hi" }], tools: [], call: async () => null });
    expect(step.mock.calls[0]![0]).not.toHaveProperty("system");
  });

  it("is what a dev server's door lends: each step posted through the door, the reads run in the page", async () => {
    const posted: Record<string, unknown>[] = [];
    const door = vi.fn(async (_path: string, init?: { method?: string; body?: string }) => {
      if (init?.method !== "POST") return { ok: true, status: 200, json: async () => ({ configured: true, model: "claude-sonnet-5-5", name: "claude" }) };
      posted.push(JSON.parse(init.body!));
      const body = posted.length === 1
        ? { content: [{ type: "tool_use", id: "t1", name: "search_graph", input: { query: "Late" } }], stop_reason: "tool_use" }
        : { content: [{ type: "text", text: '{"say": "The Late Set is unpaid.", "proposals": []}' }], stop_reason: "end_turn" };
      return { ok: true, status: 200, json: async () => body };
    });
    const ai = await aiThroughDevServer({ fetch: door });
    expect(ai.turn).toBeDefined();
    const reply = await seatResponder<AnySchema>(ai)(wedding(), "is the band paid?", { principal: planner });
    expect(reply.say).toBe("The Late Set is unpaid.");
    expect(posted[0]).toMatchObject({ system: expect.stringContaining("Read it with the tools"), messages: [{ role: "user", content: "is the band paid?" }] });
    expect(posted[0]).not.toHaveProperty("prompt");
  });
});
