import { bindSchema, createSchema, defineNode, nodeRef, Store } from "@graview/core";
import { createViews, type ViewComponent } from "@graview/react";
import { stubFast } from "@graview/tools/inline-ai";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { PagesApp, type PageContext } from "../../src/index.js";

/**
 * THE QUICK ASK IS ON EVERY PAGE, and it is the SAME one as the scene's
 * (Roadmap f-quick-ask-framework).
 *
 * The Ask box is gone from every route: no field at the foot, no chat
 * thread, no pill. Where the host gave a model, ⌘K opens the scene's own
 * quick ask, and the route is what "this" means: a record page is about
 * that record, a kind's page about that kind, a picture about the kind it
 * is a picture of. The app's setting hides it on every route, and AI off
 * hides it whatever the setting.
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

const AI = { fast: stubFast() };
const draw = (path: string, withViews = true, quickAsk?: boolean, ai: object | null = AI) =>
  renderToStaticMarkup(
    <PagesApp
      context={{ store: store(), ...(withViews ? { views: views() } : {}), ...(quickAsk !== undefined ? { quickAsk } : {}), ...(ai ? { ai } : {}) } as PageContext<typeof schema>}
      initialPath={path}
    />,
  );

describe("the quick ask on every page", () => {
  it("is the scene's own quick ask on every route, with no Ask box and no pill to press", () => {
    for (const path of ["/", "/tasks", "/tasks/t1", "/places", "/places/the-board", "/problems", "/map"]) {
      const html = draw(path);
      expect(html, path).toContain('data-graview-quick-ask="pages"');
      expect(html, path).not.toContain('data-testid="page-seat"');
      expect(html, path).not.toContain('data-testid="seat-field"');
      expect(html, path).not.toContain("◆");
    }
  });

  it("is not there at all when the app handed the face no views, because there is no provider to answer from", () => {
    const html = draw("/", false);
    expect(html).not.toContain("data-graview-quick-ask");
    expect(html).not.toContain('data-testid="setting-intelligence"');
  });

  it("is on no route when the app's setting hides it, or with AI off, as the scene draws none", () => {
    for (const path of ["/", "/tasks", "/tasks/t1", "/places/the-board", "/problems"]) {
      expect(draw(path, true, false), path).not.toContain("data-graview-quick-ask");
      expect(draw(path, true, true), path).toContain("data-graview-quick-ask");
      expect(draw(path, true, true, { off: true, fast: stubFast() }), path).not.toContain("data-graview-quick-ask");
      expect(draw(path, true, true, null), path).not.toContain("data-graview-quick-ask");
    }
  });

  it("asks the reader nowhere which machine answers: the host decided, so no page and no menu offers a choice", () => {
    const html = draw("/");
    expect(html).toContain('data-testid="profile-button"');
    expect(html).not.toContain('data-testid="setting-intelligence"');
    expect(html).not.toContain('data-testid="seat-settings"');
    expect(html).not.toMatch(/graph-native|Answers come from|What answers/);
  });
});
