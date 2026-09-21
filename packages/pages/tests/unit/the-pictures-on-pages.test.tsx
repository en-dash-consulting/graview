import { createSchema, defineNode, Store } from "@graview/core";
import { createViews, type ViewComponent } from "@graview/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { PagesApp, placePath, type PageContext } from "../../src/index.js";

/**
 * THE APP'S PICTURES ARE PAGES. The scene shows each kind's named lenses on
 * its district's board; the routed face showed piles and records and no
 * pictures at all. Given the view registry, every place is a page at its
 * name, an index lands you among them, the home leads with them, a kind's
 * page lists its own, and the nav is the scene's bar in the page's idiom.
 */
const task = defineNode("task", { fields: z.object({ label: z.string() }), plural: "Tasks", description: "Things to do." });
const schema = createSchema([task]);
const store = () =>
  new Store({
    schema,
    mutations: [],
    snapshot: {
      nodes: [
        { id: "t1", kind: "task", label: "Pay the deposit" },
        { id: "t2", kind: "task", label: "Book the van" },
      ] as never,
      edges: [],
    },
  });

/* A lens over the kind: it says how many it holds, and marks each as a pick. */
const Board: ViewComponent<typeof schema> = ({ nodes, label, mode }) => (
  <div data-testid="board-lens" data-mode={mode}>
    {label}: {nodes?.length ?? 0} on the board
    {(nodes ?? []).map((node) => (
      <button key={node.id} type="button" data-graview-pick={node.id}>
        {(node as { label: string }).label}
      </button>
    ))}
  </div>
);
const views = () =>
  createViews(schema)
    .register("task", { cardinality: "many", fidelity: "full" }, Board, { title: "The board" })
    .register("task", { cardinality: "many", fidelity: "full" }, Board, { title: "The week" });

const draw = (path: string, withViews = true) => {
  const context: PageContext<typeof schema> = { store: store(), ...(withViews ? { views: views() } : {}) };
  return renderToStaticMarkup(<PagesApp context={context} initialPath={path} />);
};

describe("the pictures on pages", () => {
  it("lists every place on the index, each drawn small and inert, and links it by name", () => {
    const html = draw("/places");
    expect(html).toContain("Pictures");
    expect(html.match(/data-testid="place-card"/g)).toHaveLength(2);
    expect(html).toContain(`href="${placePath("the-board")}"`);
    expect(html).toContain(`href="${placePath("the-week")}"`);
    // The lens itself, drawn small: its own words are in the card, and the card takes no pointer.
    expect(html).toContain("The board: 2 on the board");
    expect(html.match(/data-testid="place-picture"[^>]*inert/g)).toHaveLength(2);
    expect(html).toContain("A picture of tasks");
  });

  it("draws one place full width in fullscreen mode, over the kind's members, with the way to the scene and the way to the list", () => {
    const html = draw("/places/the-week");
    expect(html).toContain('data-testid="place-lens"');
    expect(html).toContain('data-mode="fullscreen"');
    expect(html).toContain("The week: 2 on the board");
    expect(html).toContain('data-graview-pick="t1"');
    expect(html).toContain('data-testid="place-stop"');
    expect(html).toContain('href="/#view=the-week"');
    expect(html).toContain("All tasks as a list");
  });

  it("says so when no picture is called that", () => {
    expect(draw("/places/the-year")).toContain("No picture is called that");
  });

  it("mirrors the scene's bar: the pictures first, then the kinds, then Problems — and the home leads with the pictures", () => {
    const html = draw("/");
    const at = (text: string) => html.indexOf(text);
    expect(at(">The board<")).toBeGreaterThan(-1);
    expect(at(">The board<")).toBeLessThan(at(">Tasks<"));
    expect(at(">Tasks<")).toBeLessThan(at("Problems"));
    expect(html).toContain('data-testid="pictures"');
    // Pictures before the kind sections on the home page.
    expect(at('data-testid="pictures"')).toBeLessThan(at("Things to do."));
  });

  it("gives a kind's page its own pictures, by name", () => {
    const html = draw("/tasks");
    expect(html).toContain('data-testid="kind-pictures"');
    expect(html).toContain("See tasks as:");
    expect(html).toContain(">The board<");
    expect(html).toContain(">The week<");
  });

  it("is the derived site it always was when the face is given no views", () => {
    const html = draw("/", false);
    expect(html).not.toContain('data-testid="place-card"');
    expect(html).not.toContain('data-testid="pictures"');
    expect(html).not.toContain("Pictures");
    expect(draw("/places", false)).toContain("None yet");
  });
});
