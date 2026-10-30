import { bindSchema, createSchema, defineNode, nodeRef, Store } from "@graview/core";
import type { AiInteraction } from "@graview/core/catalog";
import { memoryTold } from "@graview/core/told";
import { createAiDesk } from "@graview/react";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { keepTelling, tellingDraftOf, watchTelling } from "../../src/told-card.js";

const task = defineNode("task", { fields: z.object({ label: z.string() }), label: (node) => node.label });
const user = defineNode("user", { fields: z.object({ label: z.string() }), label: (node) => node.label });
const list = defineNode("list", { fields: z.object({ label: z.string() }), label: (node) => node.label, edges: { holds: { to: ["task"], description: "its tasks" } } });
const schema = createSchema([task, user, list]);
const { defineMutation } = bindSchema(schema);
const give = defineMutation("give", {
  title: "Give it to",
  subject: { kinds: ["task"], arg: "id" },
  input: z.object({ id: nodeRef(["task"]), to: nodeRef(["user"]) }),
  describe: () => "Give it",
  apply() {},
});
const store = new Store({ schema, mutations: [give], snapshot: { nodes: [{ id: "week", kind: "list", label: "This week" }, { id: "a", kind: "task", label: "A" }, { id: "b", kind: "task", label: "B" }, { id: "sam", kind: "user", label: "Sam" }] as never, edges: [] } });
const ada = { kind: "human" as const, id: "ada" };
const entry: AiInteraction = { id: "ai-1", at: "2026-10-30T10:00:00.000Z", by: ada, target: { on: "record", id: "week" }, targetLabel: "This week", ask: { kind: "ask", said: "give these to Sam" }, offered: [], outcome: "offered", stages: [{ stage: "fast", ms: 180, model: "jev" }] };
const result = {
  interaction: entry,
  offers: [],
  ghost: { interaction: "ai-1", target: entry.target, basis: "give these to Sam", proposals: ["a", "b"].map((id) => ({ id: `each:give:${id}`, label: id, said: "Give it to", record: id, call: { name: "give", args: { id, to: "sam" } } })) },
  reading: { which: "held" as const, records: ["a", "b"], kind: "task", words: "the 2 tasks in This week", close: false },
};

describe("a telling is kept with what it did and how it ended", () => {
  it("says the words, the target by kind and id, the reading, the person named, the act over N records and the slot", () => {
    const draft = tellingDraftOf(store as never, { words: "give these to Sam", target: entry.target, result: result as never, ms: 230 });
    expect(draft).toMatchObject({
      words: "give these to Sam",
      target: { on: "record", kind: "list", id: "week" },
      reading: { which: "held", kind: "task", records: ["a", "b"] },
      people: ["sam"],
      decided: { type: "act", act: "give", records: 2 },
      slot: "graph",
      ms: 230,
      outcome: "previewed",
      interaction: "ai-1",
    });
  });

  it("hears the change it proposed accepted, then undone — a quiet sign, never a 👎", async () => {
    const told = memoryTold();
    const desk = createAiDesk(() => undefined);
    desk.record(entry);
    const telling = keepTelling(told, tellingDraftOf(store as never, { words: "give these to Sam", target: entry.target, result: result as never, ms: 230 }), ada)!;
    await Promise.resolve();
    watchTelling(desk, told, telling);
    desk.record({ ...entry, outcome: "accepted", batches: ["b1"] });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(told.list()[0]!.outcome).toBe("accepted");
    desk.record({ ...entry, outcome: "accepted", undone: true });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(told.list()[0]!.outcome).toBe("undone");
    expect(told.list()[0]!.rating).toBeUndefined();
  });
});
