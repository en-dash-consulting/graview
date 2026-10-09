import { bindSchema, createSchema, defineNode, nodeRef, Store, type Violation } from "@graview/core";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { offeredActs, sayAct, SEAT_OFFERS, suggestionsFor, whereLine } from "../../src/suggest.js";
import type { Affordance } from "../../src/types.js";

/**
 * THE SEAT OFFERS A FEW THINGS, IN THE READER'S WORDS.
 *
 * Opened with nothing asked, the seat says one plain line about where the
 * reader is — the problem on what they are looking at first — at most three
 * things to ask, and at most three acts: the repairs a broken rule names for
 * this very thing and the ones the reader pinned, each said about the thing
 * and never by the mutation's name.
 */
const task = defineNode("task", {
  fields: z.object({ label: z.string(), done: z.boolean().default(false) }),
  plural: "Tasks",
  label: (node: { label: string }) => node.label,
});
const list = defineNode("list", { fields: z.object({ label: z.string() }), plural: "Lists" });
const schema = createSchema([task, list]);
const { defineMutation } = bindSchema(schema);
const finish = defineMutation("finish", {
  title: "Finish it",
  subject: { kinds: ["task"], arg: "taskId" },
  writes: ["done"],
  input: z.object({ taskId: nodeRef(["task"]) }),
  describe: () => "Finish the task",
  apply: (ctx, args) => ctx.patchNode(args.taskId, { done: true }),
});
const store = new Store({
  schema,
  mutations: [finish],
  invariants: [],
  snapshot: {
    nodes: [
      { id: "t1", kind: "task", label: "Pay the deposit", done: false },
      { id: "t2", kind: "task", label: "Book the van", done: false },
      { id: "t3", kind: "task", label: "Order boxes", done: true },
      { id: "l1", kind: "list", label: "Today" },
    ] as never,
    edges: [],
  },
});

const late: Violation = { invariant: "nothing-late", label: "Nothing late", message: '"Pay the deposit" was due 2026-08-28', nodeIds: ["t1"], repairs: [] };
const deposit = { id: "t1", name: "Pay the deposit" };

const act = (over: Partial<Affordance> & Pick<Affordance, "id" | "label" | "mutation">): Affordance => ({
  provider: "schema",
  args: {},
  open: [],
  score: 0,
  why: "",
  nodeIds: [],
  ...over,
});

describe("the line about where the reader is", () => {
  it("says the problem on the thing first, as a sentence", () => {
    expect(whereLine({ store, subject: deposit, violations: [late] })).toBe('"Pay the deposit" was due 2026-08-28.');
  });

  it("says what a record is when nothing is wrong with it", () => {
    expect(whereLine({ store, subject: { id: "t2", name: "Book the van" }, violations: [late] })).toBe("Book the van, a task.");
  });

  it("says how much is on a place, by its title, and plainly when the title is the plural", () => {
    expect(whereLine({ store, subject: { id: null, name: "The week" }, violations: [], place: { title: "The week", kind: "task" } })).toBe("The week: 3 tasks.");
    expect(whereLine({ store, subject: { id: "kind:task", name: "Tasks" }, violations: [] })).toBe("There are 3 tasks here.");
  });

  it("says the whole thing by its largest kinds when nothing is chosen", () => {
    expect(whereLine({ store, subject: { id: null, name: "the whole thing" }, violations: [] })).toBe("Everything: 3 tasks and 1 list.");
  });
});

describe("what the seat offers to ask", () => {
  it("is at most three, asks what is wrong only when something is, and is about the thing", () => {
    const troubled = suggestionsFor({ store, subject: deposit, violations: [late] });
    expect(troubled.length).toBeLessThanOrEqual(SEAT_OFFERS);
    expect(troubled.map((one) => one.ask)).toEqual(["What's wrong with Pay the deposit?", "Tell me about Pay the deposit"]);
    const calm = suggestionsFor({ store, subject: { id: "t2", name: "Book the van" }, violations: [] });
    expect(calm.map((one) => one.why)).toEqual(["about"]);
  });

  it("asks what needs attention when the trouble is elsewhere, and what is here at a place", () => {
    const here = suggestionsFor({ store, subject: { id: null, name: "the whole thing" }, violations: [late] });
    expect(here.map((one) => one.ask)).toEqual(["What needs attention?", "What is here?"]);
  });
});

describe("the acts the seat offers unprompted", () => {
  const affordances = [
    act({ id: "rename", label: "Rename", mutation: "rename", nodeIds: ["t1"] }),
    act({ id: "drop", label: "Drop it", mutation: "drop", provider: "invariant", destructive: true, nodeIds: ["t1"] }),
    act({ id: "finish", label: "Finish it", mutation: "finish", provider: "invariant", nodeIds: ["t1"], args: { taskId: "t1" } }),
    act({ id: "elsewhere", label: "Finish it", mutation: "finish", provider: "invariant", nodeIds: ["t2"], args: { taskId: "t2" } }),
    act({ id: "pinned", label: "move-to-list", mutation: "move-to-list", pinned: "user", nodeIds: ["t1"], open: [{ name: "listId" }] }),
    act({ id: "declared", label: "Block time", mutation: "block", pinned: "declared", nodeIds: ["t1"] }),
    act({ id: "another", label: "Note why", mutation: "note", pinned: "user", nodeIds: ["t1"] }),
  ];

  it("are at most three: the repairs on this thing, then the reader's pins, what cannot be taken back last", () => {
    const offered = offeredActs(affordances, { store, subject: deposit });
    expect(offered.length).toBeLessThanOrEqual(SEAT_OFFERS);
    expect(offered.map((one) => one.affordance.id)).toEqual(["finish", "pinned", "another"]);
    // Nothing the app pinned, nothing on another thing, nothing that is merely possible.
    expect(offered.map((one) => one.affordance.id)).not.toContain("rename");
    expect(offered.map((one) => one.affordance.id)).not.toContain("elsewhere");
    expect(offered.map((one) => one.affordance.id)).not.toContain("declared");
  });

  it("are said about the thing, never by the mutation's name", () => {
    const labels = offeredActs(affordances, { store, subject: deposit }).map((one) => one.label);
    expect(labels).toEqual(["Finish Pay the deposit", "Move to list", "Note why"]);
    expect(labels.join(" ")).not.toMatch(/[a-z]+-[a-z]+/);
  });

  it("are no repairs when nothing is chosen, only what the reader pinned", () => {
    expect(offeredActs(affordances, { store, subject: { id: null, name: "the whole thing" } }).map((one) => one.affordance.id)).toEqual(["pinned", "another"]);
  });
});

describe("an act said about its thing", () => {
  it("names what 'it' is", () => {
    expect(sayAct(act({ id: "a", label: "Give it a new date", mutation: "reschedule", nodeIds: ["t1"], open: [{ name: "due" }] }), { store, subject: deposit })).toBe("Give Pay the deposit a new date");
  });

  it("speaks a machine name, and uses the act's own sentence when nothing is left to ask", () => {
    expect(sayAct(act({ id: "b", label: "move-to-list", mutation: "move-to-list", nodeIds: ["t1"], open: [{ name: "listId" }] }), { store, subject: deposit })).toBe("Move to list");
    expect(sayAct(act({ id: "c", label: "finish", mutation: "finish", nodeIds: ["t1"], args: { taskId: "t1" } }), { store, subject: deposit })).toBe("Finish the task");
  });

  it("leaves a title with no 'it' as the title", () => {
    expect(sayAct(act({ id: "d", label: "Rename", mutation: "rename", nodeIds: ["t1"], open: [{ name: "label" }] }), { store, subject: deposit })).toBe("Rename");
  });
});
