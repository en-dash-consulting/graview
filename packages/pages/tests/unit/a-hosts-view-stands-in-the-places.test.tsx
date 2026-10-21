import { createSchema, defineNode, Store, type PagesArrangement } from "@graview/core";
import { createViews, type ViewComponent } from "@graview/react";
import { registerDefaultViews } from "@graview/primitives";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { PagesApp, type PageContext } from "../../src/index.js";

/**
 * A HOST'S VIEW STANDS IN THE PLACES, AND A HIDDEN KIND LEAVES THEM
 * (Roadmap q-custom-views-in-nav). The hosted playbook's "To do" is a
 * script view the host registers with its manifest name; `pages.order`
 * names it `view:to-do`, so the Pages drop-down lists it among the lists,
 * before the kinds, rather than with the pictures at the foot. Its eleven
 * reference lists made the drop-down "insanely long": a kind `pages.hide`
 * names is out of it — and still opens at its address, where the bar says
 * so. That the view opens first and the hidden list opens at its address
 * in a browser is `pnpm verify pages`.
 */
const task = defineNode("task", { fields: z.object({ label: z.string() }), plural: "Tasks" });
const note = defineNode("note", { fields: z.object({ label: z.string() }), plural: "Notes" });
const source = defineNode("source", { fields: z.object({ label: z.string() }), plural: "Sources" });
const schema = createSchema([task, note, source]);
const store = () =>
  new Store({
    schema,
    mutations: [],
    snapshot: {
      nodes: [
        { id: "t1", kind: "task", label: "Draft the launch post" },
        { id: "n1", kind: "note", label: "Tone: plain" },
        { id: "s1", kind: "source", label: "The brand book" },
      ] as never,
      edges: [],
    },
  });
const ToDo: ViewComponent<typeof schema> = ({ nodes }) => <p data-testid="to-do">{nodes?.length ?? 0} to do</p>;
const views = (pages: PagesArrangement) => {
  const registry = registerDefaultViews(schema, createViews(schema)).register("task", { cardinality: "many", fidelity: "full" }, ToDo, { title: "To do", name: "to-do", lens: "view" });
  registry.arrange?.(pages);
  return registry;
};

const draw = (path: string, pages: PagesArrangement) => renderToStaticMarkup(<PagesApp context={{ store: store(), views: views(pages) } as PageContext<typeof schema>} initialPath={path} />);
/** The drop-down's entries, in order, by key. */
const listed = (html: string) => {
  const list = html.slice(html.indexOf('data-testid="app-places"'));
  return [...list.matchAll(/data-testid="app-place-([^"]+)"/g)].map((match) => match[1]);
};
/** Its Lists group's entries. */
const lists = (html: string) => {
  const list = html.slice(html.indexOf('data-testid="app-places"'));
  const group = list.slice(list.indexOf('data-place-group="lists"'), list.indexOf('data-place-group="pictures"') >= 0 ? list.indexOf('data-place-group="pictures"') : undefined);
  return [...group.matchAll(/data-testid="app-place-([^"]+)"/g)].map((match) => match[1]);
};

describe("a host's view in the places", () => {
  it("stands among the lists where pages.order names it, not with the pictures", () => {
    const html = draw("/tasks", { order: ["view:to-do", "task"] });
    expect(lists(html)).toEqual(["place:task:to-do", "kind:task", "kind:note", "kind:source"]);
    expect(html).not.toContain('data-place-group="pictures"');
    expect(html).toContain('data-place-path="/places/to-do"');
  });

  it("is a picture at the foot where the order does not name it", () => {
    const html = draw("/tasks", {});
    expect(listed(html).at(-1)).toBe("place:task:to-do");
    expect(lists(html)).not.toContain("place:task:to-do");
  });

  it("is drawn at its address", () => {
    expect(draw("/places/to-do", { order: ["view:to-do"] })).toContain('data-testid="to-do">1 to do</p>');
  });
});

describe("a kind pages.hide names", () => {
  it("is not in the drop-down", () => {
    const html = draw("/tasks", { hide: ["note", "source"] });
    expect(listed(html)).not.toContain("kind:note");
    expect(listed(html)).not.toContain("kind:source");
    expect(listed(html)).toContain("kind:task");
  });

  it("still opens at its address, where the bar names it as the place you are on", () => {
    const html = draw("/notes", { hide: ["note", "source"] });
    expect(html).toContain("Tone: plain");
    expect(listed(html)).toContain("kind:note");
    expect(listed(html)).not.toContain("kind:source");
    expect(html).toMatch(/data-testid="app-place-current"[^>]*>Notes</);
  });
});
