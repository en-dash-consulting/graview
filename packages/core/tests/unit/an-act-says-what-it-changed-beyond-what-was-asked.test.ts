import { describe, expect, it } from "vitest";
import { bindSchema, createSchema, defineNode, nodeRef, Store, z } from "../../src/index.js";
import { beyondAsked } from "../../src/revisions.js";

/*
 * AN ACT SAYS WHAT IT CHANGED BEYOND WHAT WAS ASKED (Roadmap
 * f-revisions-say-what-broke). An act's answer held every primitive but not
 * apart from what was asked: closing a project closed its tasks too, and
 * removing one took its links with it, and nothing set that apart.
 */
const project = defineNode("project", { fields: z.object({ label: z.string(), status: z.enum(["open", "closed"]) }), plural: "Projects" });
const task = defineNode("task", { fields: z.object({ label: z.string(), done: z.boolean() }), edges: { partOf: { to: ["project"], description: "the project it is part of" } }, plural: "Tasks" });
const schema = createSchema([project, task]);
const { defineMutation } = bindSchema(schema);
const rename = defineMutation("rename-project", { title: "Rename", input: z.object({ projectId: nodeRef(["project"]), label: z.string() }), apply: (ctx, args) => ctx.patchNode(args.projectId, { label: args.label }) });
const close = defineMutation("close-project", {
  title: "Close a project",
  input: z.object({ projectId: nodeRef(["project"]) }),
  apply(ctx, args) {
    ctx.patchNode(args.projectId, { status: "closed" });
    for (const one of ctx.graph.in(args.projectId, "partOf")) ctx.patchNode(one.id, { done: true });
  },
});
const remove = defineMutation("remove-project", {
  title: "Remove a project",
  input: z.object({ projectId: nodeRef(["project"]) }),
  apply(ctx, args) {
    ctx.removeNode(args.projectId);
  },
});
const addTask = defineMutation("add-task", {
  title: "Add a task",
  creates: ["task"],
  input: z.object({ projectId: nodeRef(["project"]), label: z.string() }),
  apply(ctx, args) {
    const id = ctx.freshId(args.label, "task");
    ctx.addNode({ id, kind: "task", label: args.label, done: false });
    ctx.addEdge({ kind: "partOf", from: id, to: args.projectId });
  },
});
const store = () =>
  new Store({
    schema,
    mutations: [rename, close, remove, addTask],
    snapshot: {
      nodes: [
        { id: "p1", kind: "project", label: "Kitchen", status: "open" },
        { id: "t1", kind: "task", label: "Tile", done: false },
        { id: "t2", kind: "task", label: "Paint", done: false },
      ] as never,
      edges: [
        { kind: "partOf", from: "t1", to: "p1" },
        { kind: "partOf", from: "t2", to: "p1" },
      ],
    },
  });
const label = (app: ReturnType<typeof store>) => (id: string) => app.graph.getNode(id)?.label as string | undefined;

describe("what an act changed beyond what was asked", () => {
  it("says the records its own body changed besides its target", () => {
    const app = store();
    const reach = beyondAsked(app.apply({ name: "close-project", args: { projectId: "p1" } }), { label: label(app) });
    expect(reach.asked).toEqual([expect.objectContaining({ act: "close-project", records: ["p1"] })]);
    expect(reach.beyond).toEqual([expect.objectContaining({ change: "changed", record: "t1", fields: ["done"] }), expect.objectContaining({ change: "changed", record: "t2", fields: ["done"] })]);
    expect(reach.text).toBe('Besides what was asked, it also changed "Tile" (done), "Paint" (done).');
  });

  it("says the links a removal took with it", () => {
    const app = store();
    const reach = beyondAsked(app.apply({ name: "remove-project", args: { projectId: "p1" } }), { label: label(app) });
    expect(reach.beyond.map((one) => one.change)).toEqual(["unlinked", "unlinked"]);
    expect(reach.text).toBe('Besides what was asked, it also took the link "Tile" partOf "Kitchen", "Paint" partOf "Kitchen".');
  });

  it("says nothing more of an act that changed only its own: the record it made and its link to the one it named", () => {
    const app = store();
    expect(beyondAsked(app.apply({ name: "add-task", args: { projectId: "p1", label: "Grout" } })).text).toBe("It changed only what was asked.");
    expect(beyondAsked(app.apply({ name: "rename-project", args: { projectId: "p1", label: "Kitchen and hall" } })).beyond).toEqual([]);
  });

  it("holds a batch to the acts asked: an act nobody asked for is beyond it whole", () => {
    const app = store();
    const answer = app.applyAll([
      { name: "rename-project", args: { projectId: "p1", label: "Kitchen and hall" } },
      { name: "close-project", args: { projectId: "p1" } },
    ]);
    const reach = beyondAsked(answer, { asked: [{ name: "rename-project", args: { projectId: "p1", label: "Kitchen and hall" } }] });
    expect(reach.asked.map((one) => one.act)).toEqual(["rename-project"]);
    expect(reach.beyond.map((one) => ("record" in one ? one.record : one.change))).toEqual(["p1", "t1", "t2"]);
  });
});
