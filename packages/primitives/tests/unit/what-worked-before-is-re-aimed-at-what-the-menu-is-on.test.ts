import { bindSchema, createSchema, defineNode, nodeRef, Store } from "@graview/core";
import { tellingOf, type TellingDraft } from "@graview/core/told";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { reaimed } from "../../src/menu-told.js";

const task = defineNode("task", { fields: z.object({ label: z.string(), done: z.boolean().default(false) }), plural: "Tasks", noun: "task", label: (node) => node.label });
const list = defineNode("list", { fields: z.object({ label: z.string() }), plural: "Lists", label: (node) => node.label, edges: { holds: { to: ["task"], description: "the tasks on it" } } });
const schema = createSchema([task, list]);
const { defineMutation } = bindSchema(schema);
const finish = defineMutation("finish", {
  title: "Mark it done",
  subject: { kinds: ["task"], arg: "id" },
  input: z.object({ id: nodeRef(["task"]) }),
  describe: () => "Mark it done",
  apply() {},
});
const store = new Store({
  schema,
  mutations: [finish],
  snapshot: {
    nodes: [
      { id: "week", kind: "list", label: "This week" },
      { id: "today", kind: "list", label: "Today" },
      ...["a", "b", "c"].map((id) => ({ id, kind: "task", label: `Task ${id}`, done: false })),
    ] as never,
    edges: ["a", "b", "c"].map((id) => ({ kind: "holds", from: "week", to: id })) as never,
  },
});
const told = (draft: Partial<TellingDraft>) =>
  tellingOf({ words: "mark these done", target: { on: "record", kind: "list", id: "today" }, reading: { which: "held", kind: "task", records: ["x", "y"] }, decided: { type: "act", act: "finish", records: 2 }, outcome: "accepted", ...draft }, { kind: "human", id: "ada" })!;

describe("a similar telling that worked is suggested, re-aimed at what the menu is on", () => {
  it("says the act over the records here, as it was over the records there: the act's own words, its object put in", () => {
    expect(reaimed(store as never, told({}), "week")).toBe("Mark the 3 tasks in This week done, like last time");
  });

  it("says the record itself where it was the record itself", () => {
    expect(reaimed(store as never, told({ target: { on: "record", kind: "task", id: "x" }, reading: { which: "itself", kind: "task", records: ["x"] }, decided: { type: "act", act: "finish", records: 1 } }), "a")).toBe("Mark Task a done, like last time");
  });

  it("offers nothing where it cannot be aimed: no record of the kind it acted on, or an act the app no longer has", () => {
    expect(reaimed(store as never, told({}), "today")).toBeUndefined();
    expect(reaimed(store as never, told({ decided: { type: "act", act: "gone", records: 2 } }), "week")).toBeUndefined();
  });
});
