import { bindSchema, createSchema, defineNode, Store } from "@graview/core";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { beginningsFor, createPageRegistry, PagesApp, type PageContext } from "../../src/index.js";

/**
 * THE WORDS FIND IT ON A PAGE TOO. `/search?q=` is the Find box's matcher at
 * an address: the same hits grouped by kind with the same why, each heading
 * a link to its list with the words carried; a list narrowed by words shows
 * why each row is there; and nothing found is honest — what was searched,
 * and the beginnings the seat may run with the words already in the name.
 */
const list = defineNode("list", {
  fields: z.object({ label: z.string() }),
  plural: "Lists",
  edges: { holds: { to: ["task"], description: "the tasks on this list", inverse: "the list it is on" } },
});
const task = defineNode("task", {
  fields: z.object({ label: z.string(), done: z.boolean(), notes: z.string().optional() }),
  plural: "Tasks",
  lifecycle: { field: "done", retired: [true] },
});
const schema = createSchema([list, task]);
const { defineMutation } = bindSchema(schema);
const addTask = defineMutation("add-task", {
  title: "Add a task",
  creates: ["task"],
  input: z.object({ label: z.string().min(1) }),
  apply(ctx, args) {
    ctx.addNode({ id: ctx.freshId(args.label, "task"), kind: "task", label: args.label, done: false });
  },
});
const addList = defineMutation("add-list", {
  title: "Start a list",
  creates: ["list"],
  input: z.object({ label: z.string().min(1) }),
  apply(ctx, args) {
    ctx.addNode({ id: ctx.freshId(args.label, "list"), kind: "list", label: args.label });
  },
});
const store = () =>
  new Store({
    schema,
    mutations: [addTask, addList],
    snapshot: {
      nodes: [
        { id: "today", kind: "list", label: "Today" },
        { id: "vans", kind: "list", label: "Van things" },
        { id: "t-van", kind: "task", label: "Book the van", done: false },
        { id: "t-call", kind: "task", label: "Call the agent", done: false, notes: "Ask whether the van fits the sofa" },
        { id: "t-old", kind: "task", label: "Return the van", done: true },
      ] as never,
      edges: [{ kind: "holds", from: "today", to: "t-van" }],
    },
  });
const draw = (path: string, extra: Partial<PageContext<typeof schema>> = {}) =>
  renderToStaticMarkup(<PagesApp context={{ store: store(), ...extra }} initialPath={path} />);

describe("/search", () => {
  it("lists what the words find grouped by kind, each heading a link to its list with the words carried", () => {
    const html = draw("/search?q=van");
    expect(html).toContain("1 list and 2 tasks for “van”");
    expect(html).toContain('href="/tasks?q=van"');
    expect(html).toContain('href="/lists?q=van"');
    expect(html).toContain('href="/tasks/t-call"');
    // Found by a field, and said so.
    expect(html).toContain("Notes: Ask whether the van fits the sofa");
    // The past is not searched unless asked, and the page says so.
    expect(html).not.toContain('href="/tasks/t-old"');
    expect(html).toContain("current ones; add is:any for past ones.");
    expect(draw("/search?q=van%20is:any")).toContain('href="/tasks/t-old"');
  });

  it("names a kind by its plural and links to it", () => {
    const html = draw("/search?q=tasks");
    expect(html).toContain('data-about="kind"');
    expect(html).toContain('href="/tasks"');
  });

  it("is honest about nothing, and offers the beginnings with the words already in the name", () => {
    const html = draw("/search?q=zzz");
    expect(html).toContain("Nothing here is called “zzz”.");
    expect(html).toContain("Lists and tasks, current ones; add is:any for past ones.");
    expect(html).toContain("A task called “zzz”");
    expect(html).toContain("A list called “zzz”");
    // The press keeps the act's own words.
    expect(html).toMatch(/<button type="submit"[^>]*>Add a task<\/button>/);
    // Prefilled, and still editable: a value in the field, not an argument decided.
    expect(html).toMatch(/<input[^>]*value="zzz"/);
  });

  it("offers only the beginnings the seat may run", () => {
    const guarded = new Store({
      schema,
      mutations: [addTask, addList],
      policy: { roles: ["keeper", "reader"], grants: [{ roles: ["keeper"], mutations: ["add-list"], describe: "Keepers start lists." }] },
      snapshot: { nodes: [], edges: [] },
    });
    const offered = beginningsFor(guarded, ["list", "task"], { principal: { kind: "human", id: "k", roles: ["keeper"] } });
    expect(offered.map((beginning) => beginning.mutation.name)).toEqual(["add-list"]);
    expect(offered[0]?.arg).toBe("label");
  });

  it("is a route an app's own page cannot quietly take", () => {
    const warnings: string[] = [];
    const warn = console.warn;
    console.warn = (message: string) => warnings.push(message);
    createPageRegistry(schema).route("/search", () => null);
    console.warn = warn;
    expect(warnings[0]).toContain("shadows the derived search page");
  });
});

describe("the nav box", () => {
  it("narrows the list it is on, and goes to /search from anywhere else", () => {
    expect(draw("/tasks?q=van")).toMatch(/data-testid="nav-find"[^>]*placeholder="Narrow tasks…"[^>]*value="van"/);
    expect(draw("/")).toMatch(/data-testid="nav-find"[^>]*placeholder="Find…"/);
    expect(draw("/search?q=van")).toMatch(/data-testid="nav-find"[^>]*value="van"/);
  });

  it("shows why each row of a narrowed list is there when it was not the name", () => {
    const html = draw("/tasks?q=van");
    expect(html).toContain("Notes: Ask whether the van fits the sofa");
  });

  it("starts the list's own beginning with the words when they found nothing", () => {
    const html = draw("/tasks?q=zzz");
    expect(html).toContain("Nothing here is called “zzz”.");
    expect(html).toMatch(/<input[^>]*value="zzz"/);
  });
});
