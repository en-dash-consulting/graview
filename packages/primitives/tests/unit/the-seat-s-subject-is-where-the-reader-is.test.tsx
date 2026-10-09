// @vitest-environment jsdom
/* React's act() wants to know it is in a test environment. */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { bindSchema, createSchema, defineNode, Store } from "@graview/core";
import { EMPTY_VIEW, withFocus, withWithin } from "@graview/layout";
import { createViews, GraviewProvider } from "@graview/react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { Companion, registerDefaultViews } from "../../src/index.js";

/**
 * THE COMPANION NAMES WHAT "THIS" IS.
 *
 * The seat used to find its referent by walking the ground behind the
 * pointer, which is a gesture you had to turn on and a body in the middle
 * of the picture. The rail reads it from where you already are: the
 * selection when there is one, else what the pointer has settled on, else
 * the place you are looking at — said in the header, so the panel and the
 * person cannot disagree about what a message means.
 */
const task = defineNode("task", { fields: z.object({ label: z.string() }), plural: "Tasks" });
const note = defineNode("note", { fields: z.object({ label: z.string() }), plural: "Notes" });
const schema = createSchema([task, note]);
bindSchema(schema);
const store = () =>
  new Store({
    schema,
    mutations: [],
    invariants: [],
    snapshot: { nodes: [{ id: "t1", kind: "task", label: "Pay the deposit" }, { id: "t2", kind: "task", label: "Book the van" }] as never, edges: [] },
  });

const draw = (view = EMPTY_VIEW, selection: readonly string[] = []) =>
  renderToStaticMarkup(
    <GraviewProvider
      store={store()}
      views={registerDefaultViews(schema, createViews(schema))}
      initialView={view}
      initialSelection={selection}
    >
      <Companion<typeof schema> />
    </GraviewProvider>,
  );

describe("a companion names its subject", () => {
  it("is about the whole thing when nothing is chosen and nothing is pointed at", () => {
    const html = draw();
    expect(html).toContain('data-testid="companion"');
    expect(html).toContain('data-graview-because="place"');
    expect(html).toContain("the whole thing");
  });

  it("is about the selection when there is one, by the thing's own name", () => {
    const html = draw(EMPTY_VIEW, ["t1"]);
    expect(html).toContain('data-graview-because="selection"');
    expect(html).toContain('data-graview-subject="t1"');
    expect(html).toContain("Pay the deposit");
  });

  it("says how many more when several are chosen", () => {
    expect(draw(EMPTY_VIEW, ["t1", "t2"])).toContain("Book the van and 1 more");
  });

  it("is about the place you are looking at, by its registered name", () => {
    const html = draw(withWithin(withFocus(EMPTY_VIEW, "aggregate:task"), "view", "the-list"), []);
    expect(html).toContain('data-graview-because="place"');
    expect(html).toContain("Tasks");
  });

  it("names a group of several kinds by their plurals, never by its id", () => {
    const html = draw(withFocus(EMPTY_VIEW, "aggregate:note+task"), []);
    expect(html).toContain("Notes and Tasks");
    expect(html.replace(/<[^>]*>/g, " ")).not.toContain("note+task");
  });

  it("carries the acts, the relations, the conversation and the key in one panel", () => {
    const html = draw(EMPTY_VIEW, ["t1"]);
    expect(html).toContain('aria-label="Inspector"');
    expect(html).toContain('data-testid="chat-panel"');
    expect(html).toContain('data-graview-anchor="rail"');
    // And no pill to press: the rail is what opens.
    expect(html).not.toContain('data-testid="chat"');
  });

  it("puts itself away and comes back, and stays a tab stop either way", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () =>
      root.render(
        <GraviewProvider store={store()} views={registerDefaultViews(schema, createViews(schema))} initialView={EMPTY_VIEW}>
          <Companion<typeof schema> />
        </GraviewProvider>,
      ),
    );
    const dock = host.querySelector<HTMLButtonElement>('[data-testid="companion-dock"]')!;
    expect(host.querySelector('[data-graview-companion]')!.getAttribute("data-graview-companion")).toBe("open");
    await act(async () => dock.click());
    expect(host.querySelector('[data-graview-companion]')!.getAttribute("data-graview-companion")).toBe("shut");
    // Put away to its tab (FR-78), which is the tab stop that brings it back.
    const tab = host.querySelector<HTMLButtonElement>('[data-testid="companion-tab"]')!;
    expect(tab).not.toBeNull();
    expect(host.querySelector('[data-testid="chat-panel"]')).toBeNull();
    await act(async () => tab.click());
    expect(host.querySelector('[data-graview-companion]')!.getAttribute("data-graview-companion")).toBe("open");
    expect(host.querySelector('[data-testid="companion-dock"]')).not.toBeNull();
    await act(async () => root.unmount());
    host.remove();
  });
});
