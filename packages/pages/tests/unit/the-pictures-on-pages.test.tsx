import { createSchema, defineNode, Store } from "@graview/core";
import { createViews, type ViewComponent } from "@graview/react";
import { registerDefaultViews } from "@graview/primitives";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { PagesApp, placePath, type PageContext } from "../../src/index.js";

/**
 * THE APP'S PICTURES ARE PAGES, AND THE HOME IS A GALLERY OF THEM.
 *
 * The scene shows each kind's named lenses on its district's board; the
 * routed face showed piles and records and, once it had pictures, two
 * small cards a third of the way down a readme. Given the view registry,
 * every place is a page at its name, the home LANDS on the pictures — large,
 * live, before anything else — and a kind that has no picture of its own is
 * drawn anyway, so no app opens on an empty page.
 */
const task = defineNode("task", { fields: z.object({ label: z.string() }), plural: "Tasks", description: "Things to do." });
const note = defineNode("note", { fields: z.object({ label: z.string() }), plural: "Notes", description: "Something written down." });
const schema = createSchema([task, note]);
const store = (notes: readonly string[] = []) =>
  new Store({
    schema,
    mutations: [],
    snapshot: {
      nodes: [
        { id: "t1", kind: "task", label: "Pay the deposit" },
        { id: "t2", kind: "task", label: "Book the van" },
        ...notes.map((label, index) => ({ id: `n${index}`, kind: "note", label })),
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
  registerDefaultViews(schema, createViews(schema))
    .register("task", { cardinality: "many", fidelity: "full" }, Board, { title: "The board" })
    .register("task", { cardinality: "many", fidelity: "full" }, Board, { title: "The week" });

const draw = (path: string, withViews = true, notes: readonly string[] = ["Milk"]) => {
  const context: PageContext<typeof schema> = { store: store(notes), ...(withViews ? { views: views() } : {}) };
  return renderToStaticMarkup(<PagesApp context={context} initialPath={path} />);
};

describe("the pictures on pages", () => {
  it("lands on the gallery: the standing as the headline, then every picture, large and live, before anything else", () => {
    const html = draw("/");
    const at = (text: string) => html.indexOf(text);
    expect(html).toContain('data-testid="standing">2 tasks and 1 note.</h2>');
    expect(html).toContain('data-testid="gallery"');
    expect(html.match(/data-testid="place-card"/g)).toHaveLength(2);
    expect(html).toContain(`href="${placePath("the-board")}"`);
    expect(html).toContain(`href="${placePath("the-week")}"`);
    // The lens itself, drawn live: its own words are in the card, and the card takes no pointer.
    expect(html).toContain("The board: 2 on the board");
    expect(html.match(/data-testid="place-picture"[^>]*inert/g)).toHaveLength(2);
    // The gallery comes before the row of kinds, which comes before anything recent.
    expect(at('data-testid="gallery"')).toBeLessThan(at('data-testid="kinds"'));
    // What used to be the readme is gone from the home: no section per kind with its description.
    expect(html).not.toContain("Things to do.</p>");
  });

  it("draws a kind with no picture of its own as a card anyway — a contact sheet of its members — so naming a lens replaces the card rather than adding to it", () => {
    const html = draw("/");
    // Tasks have two pictures and so no card of their own; notes have none and get one.
    expect(html.match(/data-testid="kind-card"/g)).toHaveLength(1);
    expect(html).toContain('href="/notes"');
    expect(html).toContain('data-testid="kind-sheet"');
    expect(html).toContain("Milk");
    expect(html).toContain("1 note · Something written down.");
  });

  it("says on an empty picture what would fill it, rather than showing a blank frame", () => {
    const html = draw("/", true, []);
    expect(html).toContain('data-testid="picture-empty"');
    expect(html).toContain("No notes yet");
  });

  it("puts the kinds under the gallery as one row of counts, with the way to the map when there are relations", () => {
    const html = draw("/");
    expect(html).toContain('data-testid="kinds"');
    expect(html).toContain(">Tasks</span><span");
    expect(html).toContain(">Notes</span><span");
    // No relations declared here, so no way to a map is offered.
    expect(html).not.toContain('data-testid="map-link"');
  });

  it("lists every place on the index at /places too, the same gallery", () => {
    const html = draw("/places");
    expect(html).toContain("Pictures");
    expect(html.match(/data-testid="place-card"/g)).toHaveLength(2);
    expect(html).toContain("2 tasks");
  });

  it("draws one place full width in fullscreen mode, over the kind's members, with only its own way to the list — the other places are the bar's (FR-138)", () => {
    const html = draw("/places/the-week");
    expect(html).toContain('data-testid="place-lens"');
    expect(html).toContain('data-mode="fullscreen"');
    expect(html).toContain("The week: 2 on the board");
    expect(html).toContain('data-graview-pick="t1"');
    expect(html).toContain('data-testid="place-as-list"');
    expect(html).toContain("All tasks as a list");
    // The page does not repeat the places: no sibling pictures, no way to the scene under the title (the switch is that).
    const page = html.slice(html.indexOf("<main"));
    expect(page).not.toContain('data-testid="sibling-pictures"');
    expect(page).not.toContain('data-testid="place-stop"');
    expect(page).not.toContain(`href="${placePath("the-board")}"`);
    expect(html).toMatch(/data-testid="app-place-current"[^>]*>The week</);
  });

  it("says so when no picture is called that", () => {
    expect(draw("/places/the-year")).toContain("No picture is called that");
  });

  it("has the switch and the place you are on on the one bar, and every place in the list it opens: the home, the Lists, the Pictures (FR-137, FR-138)", () => {
    const html = draw("/");
    const bar = html.slice(html.indexOf('data-testid="app-bar"'), html.indexOf("</header>"));
    expect(bar).toMatch(/data-testid="app-face-scene"[^>]*aria-pressed="false"/);
    expect(bar).toMatch(/data-testid="app-face-pages"[^>]*aria-pressed="true"/);
    expect(bar).toContain(">Scene<");
    expect(bar).toContain(">Pages<");
    expect(bar.toLowerCase()).not.toContain("overview");
    expect(bar).toMatch(/data-testid="app-place-current"[^>]*>Home</);
    const list = html.slice(html.indexOf('data-testid="app-places"'), html.indexOf("</nav>"));
    const at = (text: string) => list.indexOf(text);
    expect(at(">Home<")).toBeGreaterThan(-1);
    expect(at(">Home<")).toBeLessThan(at(">Lists<"));
    expect(at(">Lists<")).toBeLessThan(at(">Tasks<"));
    expect(at(">Tasks<")).toBeLessThan(at(">Pictures<"));
    expect(at(">Pictures<")).toBeLessThan(at(">The board<"));
    // The problems are the standing's to open; the home is the app's name, said once as the heading.
    expect(list).not.toContain("Problems");
    expect(html).toMatch(/<h1[^>]*><a[^>]*data-testid="app-home"[^>]*aria-current="page"/);
    expect(html.match(/<nav /g)).toHaveLength(1);
    // Without any picture the list holds the home and the kinds.
    const plain = draw("/", false);
    expect(plain).toContain(">Lists<");
    expect(plain).not.toContain(">The board<");
  });

  it("gives a kind's page its own pictures, by name", () => {
    const html = draw("/tasks");
    expect(html).toContain('data-testid="kind-pictures"');
    expect(html).toContain("See tasks as:");
    expect(html).toContain(">The board<");
    expect(html).toContain(">The week<");
  });

  it("still lands on a gallery when the face is given no views: every kind a card of its members' names", () => {
    const html = draw("/", false);
    expect(html).not.toContain('data-testid="place-card"');
    expect(html.match(/data-testid="kind-card"/g)).toHaveLength(2);
    expect(html).toContain("Pay the deposit");
    expect(html).toContain("Milk");
    expect(draw("/places", false)).toContain("None of its own yet");
  });
});
