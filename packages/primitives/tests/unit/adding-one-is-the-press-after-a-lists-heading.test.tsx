import { bindSchema, createSchema, defineNode, Store, z } from "@graview/core";
import { PagesApp } from "@graview/pages";
import { registerDefaultViews } from "@graview/primitives";
import { createViews } from "@graview/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

/**
 * ADDING ONE IS THE PRESS AFTER A LIST'S HEADING.
 *
 * Following a place puts the keyboard on the page's heading (a screen
 * reader is told where it arrived). "Add a task" stood at the list's end,
 * so from the heading the keyboard went back through the whole bar to reach
 * it, and making a task cost 28 presses where it had cost 21 (W-225's
 * journeys). Beside the heading it is the next stop, before the related
 * kinds, the arranging line and every row.
 */
const list = defineNode("list", { fields: z.object({ name: z.string() }), plural: "Lists", label: (node) => node.name });
const task = defineNode("task", { fields: z.object({ name: z.string() }), plural: "Tasks", label: (node) => node.name });
const schema = createSchema([list, task]);
const { defineMutation } = bindSchema(schema);
const add = defineMutation("add-task", {
  title: "Add a task",
  creates: ["task"],
  input: z.object({ name: z.string().min(1) }),
  describe: () => "Add a task",
  apply(ctx, args) {
    ctx.addNode({ id: ctx.freshId("task", "task"), kind: "task", name: args.name } as never);
  },
});
const nodes = [
  { id: "l1", kind: "list", name: "Moving" },
  { id: "t1", kind: "task", name: "Book the van" },
  { id: "t2", kind: "task", name: "Pay the deposit" },
];
const draw = () =>
  renderToStaticMarkup(
    <PagesApp
      context={{ store: new Store({ schema, mutations: [add as never], snapshot: { nodes: nodes as never, edges: [] } }), views: registerDefaultViews(schema, createViews(schema)) }}
      initialPath="/tasks"
    />,
  );

describe("a kind's list", () => {
  it("puts its way to add one right after its heading, before any link, choice or row", () => {
    const html = draw();
    const heading = html.indexOf("data-graview-page-title");
    const press = html.indexOf('data-testid="act-open-add-task"');
    expect(heading).toBeGreaterThan(-1);
    expect(press).toBeGreaterThan(heading);
    const between = html.slice(heading, press);
    expect(between).not.toMatch(/<a\s|<input|<select|<textarea/);
    expect(between.match(/<button/g) ?? []).toHaveLength(1);
    // The rows come after it, and its form opens under the head, before them.
    expect(html.indexOf("Book the van")).toBeGreaterThan(press);
    expect(html.indexOf('data-testid="form-add-task"')).toBeLessThan(html.indexOf("Book the van"));
  });
});

/*
 * TWO WAYS TO ADD ONE, WRAPPED, NEVER STACKED ON EACH OTHER. Each press is a
 * 28-pixel target that takes 4 pixels less of the line above and below it,
 * so when the presses wrapped to a second row on a phone they overlapped by
 * eight: Cloud's vendor list at 390 wide had "+Add a vendor to this category"
 * over "+Add a vendor", and a press on one landed on the other. The rows
 * stand apart by at least what the presses take back.
 */
describe("a kind's list with two ways to add one", () => {
  it("keeps the rows of presses apart by at least what each press takes back from the line", () => {
    const second = defineMutation("add-task-to-list", {
      title: "Add a task to this list",
      creates: ["task"],
      input: z.object({ name: z.string().min(1) }),
      describe: () => "Add a task to this list",
      apply(ctx, args) {
        ctx.addNode({ id: ctx.freshId("task", "task"), kind: "task", name: args.name } as never);
      },
    });
    const html = renderToStaticMarkup(
      <PagesApp
        context={{ store: new Store({ schema, mutations: [add as never, second as never], snapshot: { nodes: nodes as never, edges: [] } }), views: registerDefaultViews(schema, createViews(schema)) }}
        initialPath="/tasks"
      />,
    );
    const holder = html.match(/<span style="([^"]*)" data-testid="beginnings-open">/)?.[1] ?? "";
    const press = html.match(/<button[^>]*data-testid="act-open-add-task"[^>]*style="([^"]*)"/)?.[1] ?? "";
    const rowGap = Number(holder.match(/row-gap:\s*(\d+)px/)?.[1] ?? 0);
    const takenBack = -Number(press.match(/margin:\s*(-?\d+)px/)?.[1] ?? 0);
    expect(html.match(/data-testid="act-open-/g) ?? []).toHaveLength(2);
    expect(takenBack).toBeGreaterThan(0);
    expect(rowGap).toBeGreaterThanOrEqual(2 * takenBack);
  });
});
