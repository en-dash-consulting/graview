import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  bindSchema,
  createSchema,
  defineNode,
  nameOfAuthor,
  nodeRef,
  PermissionDeniedError,
  seenBy,
  Store,
  viaSaid,
  type Policy,
  type Principal,
} from "../../src/index.js";

/**
 * FR-06 and FR-17. "Claude, for Nick, via chat" is a fact in the log; an agent
 * may do what it AND its person may; the host's own work has a seat.
 */
const person = defineNode("person", { fields: z.object({ label: z.string() }), plural: "People" });
const task = defineNode("task", {
  fields: z.object({ label: z.string(), done: z.boolean().default(false) }),
  plural: "Tasks",
  edges: { "assigned-to": { to: ["person"], cardinality: "one", description: "who does it", inverse: "what they do" } },
});
const schema = createSchema([person, task]);
const { defineMutation } = bindSchema(schema);
const addTask = defineMutation("add-task", {
  title: "Add a task",
  input: z.object({ label: z.string() }),
  apply(ctx, args) {
    ctx.addNode({ id: ctx.freshId(args.label, "t"), kind: "task", label: args.label, done: false } as never);
  },
});
const finish = defineMutation("finish-task", {
  title: "Finish the task",
  input: z.object({ id: nodeRef(["task"]) }),
  apply(ctx, args) {
    ctx.patchNode(args.id, { done: true } as never);
  },
});
const policy: Policy = {
  roles: ["planner", "doer"],
  grants: [
    { roles: ["planner"], mutations: ["add-task"], describe: "Planners add the work." },
    { roles: ["doer"], mutations: ["finish-task"], describe: "Doers finish it." },
  ],
  sees: [{ roles: ["planner"], kinds: ["person"], describe: "Planners see who is on the team." }, { roles: "*", kinds: ["task"], describe: "Everybody sees the work." }],
};
const seed = { nodes: [{ id: "nick", kind: "person", label: "Nick" }, { id: "t1", kind: "task", label: "Pay the deposit", done: false }] as never, edges: [] };
const store = () => new Store({ schema, mutations: [addTask, finish], policy, snapshot: seed });
const nick: Principal = { kind: "human", id: "nick", name: "Nick", roles: ["doer"] };
const claude: Principal = { kind: "agent", id: "agent:claude:acct_7", name: "Claude", roles: ["planner", "doer"], onBehalfOf: nick };

describe("an agent acts for someone, through something", () => {
  it("an op applied by an agent on behalf of a person records both, and the channel", () => {
    const s = store();
    const { ops } = s.apply({ name: "finish-task", args: { id: "t1" } }, { author: claude, via: "mcp:Claude" });
    expect(ops[0]!.author.onBehalfOf?.id).toBe("nick");
    expect(ops[0]!.author.id).toBe("agent:claude:acct_7");
    expect(ops[0]!.via).toBe("mcp:Claude");
    expect(nameOfAuthor(ops[0]!.author, { graph: s.graph as never, schema })).toBe("Claude, for Nick");
    expect(viaSaid(ops[0]!.via)).toBe("via Claude");
    expect(viaSaid("web")).toBeUndefined();
  });

  it("an agent's roles are the intersection of its own and its person's; beyond them it is refused with the policy's sentence", () => {
    const s = store();
    // Claude holds planner, but Nick does not: acting for Nick, Claude may not add.
    expect(() => s.apply({ name: "add-task", args: { label: "Book the van" } }, { author: claude })).toThrow(PermissionDeniedError);
    expect(() => s.apply({ name: "add-task", args: { label: "Book the van" } }, { author: claude })).toThrow(/Not permitted: “Add a task” — a planner can\. Planners add the work\./);
    // Acting for nobody, Claude is judged as itself.
    const { onBehalfOf: _, ...alone } = claude;
    expect(() => s.apply({ name: "add-task", args: { label: "Book the van" } }, { author: alone })).not.toThrow();
  });

  it("what an agent sees is bounded the same way", () => {
    const s = store();
    expect(seenBy(s, { ...claude, onBehalfOf: undefined } as never).graph.getNode("nick")).toBeDefined();
    expect(seenBy(s, claude).graph.getNode("nick")).toBeUndefined();
  });
});

describe("a host's own work has a seat", () => {
  it("Store.apply as the system succeeds under any policy and is attributed to the system", () => {
    const s = store();
    const { ops } = s.apply({ name: "add-task", args: { label: "Set up the board" } }, { author: { kind: "system", id: "cloud:setup", name: "Graview Cloud" } });
    expect(ops[0]!.author.kind).toBe("system");
    expect(seenBy(s, { kind: "system" }).graph.getNode("nick")).toBeDefined();
  });

  it("a system acting for a person is that person, not a superuser", () => {
    const s = store();
    expect(() => s.apply({ name: "add-task", args: { label: "x" } }, { author: { kind: "system", onBehalfOf: nick } })).toThrow(PermissionDeniedError);
  });

  it("an op whose author carries a name shows that name, never the id", () => {
    const s = store();
    const { ops } = s.apply({ name: "finish-task", args: { id: "t1" } }, { author: { kind: "human", id: "user_8f3a", name: "Priya", roles: ["doer"] } });
    expect(nameOfAuthor(ops[0]!.author, { graph: s.graph as never, schema })).toBe("Priya");
  });
});
