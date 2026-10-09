import { bindSchema, createSchema, defineNode, nodeRef, Store } from "@graview/core";
import { createViews, type ViewComponent } from "@graview/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { PagesApp, type PageContext } from "../../src/index.js";

/**
 * THE ASSISTANT IS ON EVERY PAGE, and it is the SAME one.
 *
 * The scene keeps an ask field at its foot; a routed face that grew a chat
 * box of its own would be two assistants with two habits over one graph.
 * The pages face draws the same field, holding the app's one
 * conversation, and the route is what "this" means: a record page is about
 * that record, a kind's page about that kind, a picture about the kind it
 * is a picture of.
 */
const task = defineNode("task", { fields: z.object({ label: z.string(), done: z.boolean().default(false) }), plural: "Tasks" });
const schema = createSchema([task]);
const { defineMutation } = bindSchema(schema);
const finish = defineMutation("finish", {
  title: "Finish it",
  subject: { kinds: ["task"], arg: "taskId" },
  writes: ["done"],
  input: z.object({ taskId: nodeRef(["task"]) }),
  apply: (ctx, args) => ctx.patchNode(args.taskId, { done: true }),
});
const store = () =>
  new Store({
    schema,
    mutations: [finish],
    snapshot: { nodes: [{ id: "t1", kind: "task", label: "Pay the deposit", done: false }] as never, edges: [] },
  });
const Board: ViewComponent<typeof schema> = ({ nodes }) => <div>{nodes?.length ?? 0} on the board</div>;
const views = () => createViews(schema).register("task", { cardinality: "many", fidelity: "full" }, Board, { title: "The board" });

const draw = (path: string, withViews = true) =>
  renderToStaticMarkup(
    <PagesApp
      context={{ store: store(), ...(withViews ? { views: views() } : {}) } as PageContext<typeof schema>}
      initialPath={path}
    />,
  );

describe("the assistant on every page", () => {
  it("offers the scene's own ask field on every route, and no pill to press", () => {
    for (const path of ["/", "/tasks", "/tasks/t1", "/places", "/places/the-board", "/problems", "/map"]) {
      const html = draw(path);
      expect(html, path).toContain('data-testid="page-seat"');
      expect(html, path).toContain('data-testid="seat-field"');
      expect(html, path).not.toContain("◆");
    }
  });

  it("is not there at all when the app handed the face no views, because there is no provider to answer from", () => {
    const html = draw("/", false);
    expect(html).not.toContain('data-testid="page-seat"');
    expect(html).not.toContain('data-testid="seat-field"');
    expect(html).not.toContain('data-testid="setting-intelligence"');
  });

  it("asks the reader nowhere which machine answers: the host decided, so no page and no menu offers a choice", () => {
    const html = draw("/");
    expect(html).toContain('data-testid="profile-button"');
    expect(html).not.toContain('data-testid="setting-intelligence"');
    expect(html).not.toContain('data-testid="seat-settings"');
    expect(html).not.toMatch(/graph-native|Answers come from|What answers/);
  });
});
