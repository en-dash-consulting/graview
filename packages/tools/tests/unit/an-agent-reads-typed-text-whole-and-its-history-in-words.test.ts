import { createSchema, defineNode, markdownField, Store, TYPE_TEXT, z, type AnySchema, type Principal } from "@graview/core";
import "@graview/core/typing";
import { historyInWords } from "@graview/core/history";
import { describe, expect, it } from "vitest";
import { createToolRuntime } from "../../src/index.js";

/**
 * AN AGENT READS TYPED TEXT WHOLE, AND ITS HISTORY IN WORDS (Roadmap
 * f-collab-text, phase 5). However many people typed into a field a
 * keystroke at a time, a record answers an agent with the field's whole
 * text, as it always did; and the history an agent is told says each run
 * of typing as one sentence with what it put in and took out — never the
 * splices' offsets, and never the text twice.
 */
const room = defineNode("room", { fields: z.object({ label: z.string(), notes: markdownField().optional() }) });
const schema = createSchema([room]) as unknown as AnySchema;
const ada: Principal = { kind: "human", id: "ada", name: "Ada" };
const bo: Principal = { kind: "human", id: "bo", name: "Bo" };

describe("an agent and typed text", () => {
  it("reads the field whole and its history as sentences", async () => {
    const store = new Store<AnySchema>({ schema, mutations: [], snapshot: { nodes: [{ id: "kitchen", kind: "room", label: "Kitchen", notes: "Paint the walls" }], edges: [] } as never });
    const type = (author: Principal, at: number, insert: string, remove = 0) => store.apply({ name: TYPE_TEXT, args: { node: "kitchen", field: "notes", at, remove, insert } }, { author });
    type(ada, 15, " white");
    type(ada, 21, " by Friday");
    type(bo, 0, "Then ", 0);
    type(bo, 5, "p", 1);
    const runtime = createToolRuntime(store, { author: { kind: "agent", id: "helper" } });
    const read = await runtime.call("get_node", { id: "kitchen" });
    expect(JSON.stringify(read)).toContain("Then paint the walls white by Friday");
    expect(historyInWords(store).map((one) => one.sentence)).toEqual(["Bo wrote in Kitchen's notes (+6 −1)", "Ada wrote in Kitchen's notes (+16)"]);
  });
});
