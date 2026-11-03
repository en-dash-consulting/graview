// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { bindSchema, createSchema, defineNode, isoDate, nodeRef, Store, type Principal } from "@graview/core";
import { createViews } from "@graview/react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { actsBeyondFacts, blankWritable, foldedActs, PagesApp, recordFacts, relationFacts, titleFieldOf, type PageContext } from "../../src/index.js";

/**
 * AN ACT A FACT'S OWN CONTROL ALREADY DOES IS FOLDED INTO IT (Roadmap
 * f-facts-by-type).
 *
 * A task's page drew "Finished: No" and then, under "What can be done",
 * "Mark it done"; the list it is on and then "Move it to another list"; its
 * name and then "Rename". An act whose whole effect is one field or one
 * relation of this record is done where that fact is drawn, and "What can
 * be done" keeps what the facts cannot say — decided from what each act
 * declares it writes, connects and asks, never from its name.
 */
const list = defineNode("list", {
  fields: z.object({ label: z.string().min(1) }),
  plural: "Lists",
  label: (node) => node.label,
  edges: { holds: { to: ["task"], description: "the tasks on this list", inverse: "the list it is on" } },
});
const task = defineNode("task", {
  fields: z.object({
    label: z.string().min(1),
    done: z.boolean(),
    due: isoDate.optional(),
    day: z.enum(["mon", "tue", "wed"]).optional(),
    plannedAt: z.number().int().optional(),
    note: z.string().optional(),
  }),
  plural: "Tasks",
  label: (node) => node.label,
  edges: { "waits-for": { to: ["task"], description: "what has to happen first", inverse: "what is waiting on this" } },
});
const schema = createSchema([list, task]);
const { defineMutation } = bindSchema(schema);
const finish = defineMutation("finish", { title: "Mark it done", subject: { kinds: ["task"], arg: "taskId" }, writes: ["done"], input: z.object({ taskId: nodeRef(["task"]) }), apply: (ctx, args) => ctx.patchNode(args.taskId, { done: true }) });
const reopen = defineMutation("reopen", { title: "Put it back", subject: { kinds: ["task"], arg: "taskId" }, writes: ["done"], input: z.object({ taskId: nodeRef(["task"]) }), apply: (ctx, args) => ctx.patchNode(args.taskId, { done: false }) });
const reschedule = defineMutation("reschedule", { title: "Move the date", subject: { kinds: ["task"], arg: "taskId" }, writes: ["due"], input: z.object({ taskId: nodeRef(["task"]), due: isoDate }), apply: (ctx, args) => ctx.patchNode(args.taskId, { due: args.due }) });
// Named like a rename, writes two fields: not one fact's, so it stays.
const renameAndNote = defineMutation("rename", { title: "Rename", subject: { kinds: ["task"], arg: "taskId" }, writes: ["label", "note"], input: z.object({ taskId: nodeRef(["task"]), label: z.string().min(1), note: z.string() }), apply: (ctx, args) => ctx.patchNode(args.taskId, { label: args.label, note: args.note }) });
const relabel = defineMutation("relabel", { title: "Call it something else", subject: { kinds: ["task"], arg: "taskId" }, writes: ["label"], input: z.object({ taskId: nodeRef(["task"]), label: z.string().min(1) }), apply: (ctx, args) => ctx.patchNode(args.taskId, { label: args.label }) });
// Sets a day and a time and asks for a length: beyond any one fact.
const planIt = defineMutation("plan-it", { title: "Block time for it", subject: { kinds: ["task"], arg: "taskId" }, writes: ["day", "plannedAt"], input: z.object({ taskId: nodeRef(["task"]), day: z.enum(["mon", "tue", "wed"]), plannedAt: z.number().int(), minutes: z.number().int() }), apply: (ctx, args) => ctx.patchNode(args.taskId, { day: args.day, plannedAt: args.plannedAt }) });
const moveToList = defineMutation("move-to-list", { title: "Move it to another list", subject: { kinds: ["task"], arg: "taskId" }, connects: ["holds"], severs: ["holds"], input: z.object({ taskId: nodeRef(["task"]), listId: nodeRef(["list"]) }), apply: (ctx, args) => ctx.setSingleSource("holds", args.taskId, args.listId) });
const waitFor = defineMutation("wait-for", { title: "This has to happen first", subject: { kinds: ["task"], arg: "taskId" }, connects: ["waits-for"], input: z.object({ taskId: nodeRef(["task"]), blockerId: nodeRef(["task"]) }), apply: (ctx, args) => void ctx.addEdge({ kind: "waits-for", from: args.taskId, to: args.blockerId }) });
const stopWaiting = defineMutation("stop-waiting", { title: "It no longer has to wait", subject: { kinds: ["task"], arg: "taskId" }, severs: ["waits-for"], input: z.object({ taskId: nodeRef(["task"]), blockerId: nodeRef(["task"]) }), apply: (ctx, args) => void ctx.removeEdge({ kind: "waits-for", from: args.taskId, to: args.blockerId }) });
// Makes a record and ties it: never a fact's.
const explain = defineMutation("explain", { title: "Note why this is here", subject: { kinds: ["task"], arg: "taskId" }, creates: ["list"], connects: ["holds"], writes: [], input: z.object({ taskId: nodeRef(["task"]), label: z.string().min(1) }), apply: (ctx, args) => { const id = ctx.freshId(args.label, "list"); ctx.addNode({ id, kind: "list", label: args.label }); ctx.addEdge({ kind: "holds", from: id, to: args.taskId }); } });

const KEEPER: Principal = { kind: "human", id: "user-kim", roles: ["keeper"] };

function todo() {
  return new Store({
    schema,
    mutations: [finish, reopen, reschedule, relabel, renameAndNote, planIt, moveToList, waitFor, stopWaiting, explain],
    snapshot: {
      nodes: [
        { id: "home", kind: "list", label: "Home" },
        { id: "someday", kind: "list", label: "Someday" },
        { id: "paint", kind: "task", label: "Touch up the paint", done: false },
        { id: "buy", kind: "task", label: "Buy paint", done: false },
        { id: "tape", kind: "task", label: "Tape the edges", done: false },
      ] as never,
      edges: [
        { kind: "holds", from: "someday", to: "paint" },
        { kind: "waits-for", from: "paint", to: "buy" },
      ],
    },
  });
}

/** The facts the page would draw: its fields, blanks it may fill among them, and the heading's field. */
function drawn(store: Store<typeof schema>) {
  const facts = recordFacts(store, "paint", { blanks: blankWritable(store, "paint") })!;
  const title = titleFieldOf(store, "paint", facts.label);
  const fields = [...facts.fields.map((field) => field.key), ...(title ? [title] : [])];
  return { facts, fields, relations: relationFacts(store, "paint", facts) };
}

const mutationsOf = (store: Store<typeof schema>, ids: Iterable<string>) => {
  const { facts } = drawn(store);
  return [...ids].map((id) => facts.actions.affordances.find((one) => one.id === id)!.mutation).sort();
};

describe("what can be done beyond the facts", () => {
  it("folds an act that sets one drawn field, or ties one drawn relation, into that fact", () => {
    const store = todo();
    const { facts, fields, relations } = drawn(store);
    const folded = foldedActs(store, "paint", facts.actions, { fields, relations });
    expect(mutationsOf(store, folded)).toEqual(["finish", "move-to-list", "relabel", "reschedule", "stop-waiting", "wait-for"]);
  });

  it("keeps an act that writes two fields, asks for more than a fact gives, or makes a record — whatever it is called", () => {
    const store = todo();
    const { facts, fields, relations } = drawn(store);
    const beyond = actsBeyondFacts(store, "paint", facts.actions, { fields, relations }).affordances.map((one) => one.mutation);
    expect(beyond).toEqual(expect.arrayContaining(["rename", "plan-it", "explain"]));
    expect(beyond).not.toEqual(expect.arrayContaining(["finish"]));
  });

  it("folds nothing into a fact the page does not draw", () => {
    const store = todo();
    const { facts, relations } = drawn(store);
    const folded = foldedActs(store, "paint", facts.actions, { fields: [], relations: [] });
    expect(folded.size).toBe(0);
    // And a relation not drawn keeps its acts.
    expect(mutationsOf(store, foldedActs(store, "paint", facts.actions, { fields: [], relations: relations.filter((one) => one.edgeKind !== "holds") }))).toEqual(["stop-waiting", "wait-for"]);
  });
});

describe("a relation as a row of the facts", () => {
  it("holds one where its act moves it, and many where it adds; one with none yet is drawn with the way to add one", () => {
    const store = todo();
    store.apply({ name: "stop-waiting", args: { taskId: "paint", blockerId: "buy" } });
    const { relations } = drawn(store);
    const onList = relations.find((one) => one.edgeKind === "holds")!;
    expect(onList).toMatchObject({ label: "The list it is on", direction: "in", one: true });
    expect(onList.targets.map((one) => one.label)).toEqual(["Someday"]);
    expect(onList.set?.affordance.mutation).toBe("move-to-list");
    expect(onList.set?.arg).toBe("listId");
    const first = relations.find((one) => one.edgeKind === "waits-for" && one.direction === "out")!;
    expect(first).toMatchObject({ label: "What has to happen first", one: false, targets: [] });
    expect(first.set?.affordance.mutation).toBe("wait-for");
  });
});

describe("on the record's page", () => {
  async function opened() {
    const store = todo();
    const context: PageContext<typeof schema> = { store, views: createViews(schema), principal: KEEPER };
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => root.render(<PagesApp context={context} initialPath="/tasks/paint" />));
    return { store, host, done: async () => (await act(async () => root.unmount()), host.remove()) };
  }

  it("lists under What can be done only what no fact's control does, as a quiet list", async () => {
    const { host, done } = await opened();
    const acts = [...host.querySelectorAll("[data-testid='record-actions'] [data-affordance]")].map((button) => button.textContent);
    expect(acts).not.toContain("Mark it done");
    expect(acts).not.toContain("Move the date");
    expect(acts).not.toContain("Move it to another list");
    expect(acts).not.toContain("This has to happen first");
    expect(acts).toEqual(expect.arrayContaining(["Rename", "Block time for it", "Note why this is here"]));
    expect(host.querySelector("[data-testid='record-actions'] [role='toolbar']")?.getAttribute("aria-orientation")).toBe("vertical");
    // The finished switch, the empty date's way in and the heading's rename stand among the facts.
    expect(host.querySelector('[data-testid="record-fields"] [role="switch"][data-graview-field="done"]')).not.toBeNull();
    expect(host.querySelector('[data-graview-blank-fact="due"] button')?.textContent).toBe("Pick a day");
    expect(host.querySelector('[data-graview-page-title] [data-graview-editable="relabel"]')).not.toBeNull();
    await done();
  });

  it("changes the list it is on from its chip's picker, through the act that moves it", async () => {
    const { store, host, done } = await opened();
    const row = host.querySelector('[data-graview-relation="holds"]')!;
    expect(row.querySelector("dt")?.textContent).toBe("The list it is on");
    expect(row.querySelector("[data-graview-chip='someday'] a")?.getAttribute("href")).toBe("/lists/someday");
    const caret = row.querySelector<HTMLButtonElement>("[data-graview-relation-set]")!;
    expect(caret.getAttribute("aria-label")).toBe("Move it to another list");
    await act(async () => caret.click());
    const candidates = [...row.querySelectorAll<HTMLButtonElement>("[data-graview-candidate]")];
    expect(candidates.map((one) => one.textContent)).toEqual(["Home"]);
    await act(async () => candidates[0]!.click());
    expect(store.graph.in("paint", "holds").map((node) => node.id)).toEqual(["home"]);
    expect(store.log.all().at(-1)?.mutation).toMatchObject({ name: "move-to-list" });
    await done();
  });

  it("adds to and takes from a relation of many by its chips", async () => {
    const { store, host, done } = await opened();
    const row = () => host.querySelector('[data-graview-relation="waits-for"][data-graview-direction="out"]')!;
    const remove = row().querySelector<HTMLButtonElement>("[data-graview-chip='buy'] [data-graview-relation-remove]")!;
    expect(remove.getAttribute("aria-label")).toBe("It no longer has to wait: Buy paint");
    await act(async () => remove.click());
    expect(store.graph.out("paint", "waits-for")).toEqual([]);
    const add = row().querySelector<HTMLButtonElement>("[data-graview-relation-set]")!;
    expect(add.textContent).toBe("This has to happen first");
    await act(async () => add.click());
    const tape = [...row().querySelectorAll<HTMLButtonElement>("[data-graview-candidate]")].find((one) => one.textContent === "Tape the edges")!;
    await act(async () => tape.click());
    expect(store.graph.out("paint", "waits-for").map((node) => node.id)).toEqual(["tape"]);
    await done();
  });
});
