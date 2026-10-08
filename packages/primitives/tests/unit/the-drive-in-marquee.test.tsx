// @vitest-environment jsdom
/* React's act() wants to know it is in a test environment. */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { createSchema, defineNode, Store } from "@graview/core";
import { EMPTY_VIEW, type ViewState } from "@graview/layout";
import { createViews, GraviewProvider, type ViewComponent } from "@graview/react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { registerDefaultViews } from "../../src/index.js";

/**
 * THE DRIVE-IN'S MARQUEE. From altitude a kind with a named picture draws
 * its showings on its district card as real, labeled buttons; a kind
 * with only untitled defaults draws none; in the stack there is no
 * marquee at all. Pressing a showing focuses the kind with it and
 * descends in one gesture.
 */
const task = defineNode("task", { fields: z.object({ label: z.string() }), plural: "Tasks" });
const note = defineNode("note", { fields: z.object({ label: z.string() }), plural: "Notes" });
const schema = createSchema([task, note]);
// A lens with controls of its own, as a calendar has: its Previous must never end up inside the marquee's button.
const Week: ViewComponent<typeof schema> = () => (
  <div>
    the week <button type="button">Previous</button>
  </div>
);
const views = () =>
  registerDefaultViews(schema, createViews(schema))
    .register("task", { cardinality: "many", fidelity: "full" }, Week, { title: "The week" })
    .register("task", { cardinality: "many", fidelity: "full" }, Week, { title: "The month" });
const store = () =>
  new Store({ schema, snapshot: { nodes: [{ id: "t1", kind: "task", label: "Pay" }, { id: "n1", kind: "note", label: "A note" }] as never, edges: [] } });

(Element.prototype as { scrollTo?: unknown }).scrollTo = () => {};

async function mounted(view: ViewState, onView?: (next: ViewState) => void, focused = false) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  const registry = views();
  const Card = registry.lookup("task", { cardinality: "many", fidelity: "glyph" }) as ViewComponent<typeof schema>;
  const NoteCard = registry.lookup("note", { cardinality: "many", fidelity: "glyph" }) as ViewComponent<typeof schema>;
  const at = store();
  await act(async () =>
    root.render(
      <GraviewProvider store={at} views={registry} initialView={view} {...(onView ? { onViewChange: onView } : {})}>
        <Card nodes={at.graph.nodesOfKind("task" as never) as never} fidelity="glyph" cardinality="many" mode="scene" selected={false} label="Tasks" focused={focused} />
        <NoteCard nodes={at.graph.nodesOfKind("note" as never) as never} fidelity="glyph" cardinality="many" mode="scene" selected={false} label="Notes" />
      </GraviewProvider>,
    ),
  );
  return { host, unmount: () => act(async () => root.unmount()) };
}

describe("the marquee", () => {
  it("draws the showings as labeled buttons from altitude, and none for a kind with only untitled defaults", async () => {
    const { host, unmount } = await mounted({ ...EMPTY_VIEW, overview: true });
    const marquee = host.querySelector('[data-testid="drive-in-task"]')!;
    expect(marquee).not.toBeNull();
    // No stand-in screen: the marquee is the sign. A dark slab read as a broken picture.
    expect(marquee.querySelector(".graview-drive-in-screen")).toBeNull();
    const buttons = [...marquee.querySelectorAll("button[aria-label]")];
    expect(buttons.map((button) => button.getAttribute("aria-label"))).toEqual(["Tasks: The week", "Tasks: The month"]);
    // The lens drawn small keeps its own buttons, and none of them is inside the press: a button in a button is invalid HTML.
    expect(marquee.querySelector("button button")).toBeNull();
    expect(host.querySelector('[data-testid="drive-in-note"]')).toBeNull();
    await unmount();
  });

  it("draws no marquee in the stack", async () => {
    const { host, unmount } = await mounted(EMPTY_VIEW);
    expect(host.querySelector('[data-testid="drive-in-task"]')).toBeNull();
    await unmount();
  });

  it("says each showing by its whole name, and draws no lens too small to read (FR-118)", async () => {
    const { host, unmount } = await mounted({ ...EMPTY_VIEW, overview: true });
    const thumbs = [...host.querySelectorAll('[data-testid="drive-in-task"] .graview-drive-in-thumb')];
    expect(thumbs).toHaveLength(2);
    expect(thumbs.map((thumb) => thumb.querySelector(".graview-drive-in-thumb-title")?.textContent)).toEqual(["The week", "The month"]);
    // The marquee says the names; the picture is the billboard's, at its own size.
    expect(host.querySelector('[data-testid="drive-in-task"]')!.textContent).not.toContain("the week");
    expect(host.querySelector(".graview-drive-in-thumb-picture")).toBeNull();
    await unmount();
  });

  it("focuses the kind with that showing and STAYS ALOFT: the billboard shows it, the graview is not left", async () => {
    const seen: ViewState[] = [];
    const { host, unmount } = await mounted({ ...EMPTY_VIEW, overview: true }, (next) => seen.push(next));
    await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="showing-the-month"]')!.click());
    const landed = seen.at(-1)!;
    expect(landed.overview).toBe(true);
    expect(landed.focusId).toBe("aggregate:task");
    expect(landed.within?.["view"]).toBe("the-month");
    await unmount();
  });

  /*
   * A LENS DOUBLE-CLICKED FROM UP OPENS IT. The second click of a
   * double-click arrives as a click whose `detail` is 2: it goes down into
   * that picture, the same stop the bar's place list makes. It used to land
   * on the showing the first click had just pressed, and do nothing.
   */
  it("goes down into the picture on a double-click: the kind in focus, on the ground, with that picture in.view", async () => {
    const seen: ViewState[] = [];
    const { host, unmount } = await mounted({ ...EMPTY_VIEW, overview: true }, (next) => seen.push(next));
    const press = () => host.querySelector<HTMLButtonElement>('[data-testid="showing-the-month"]')!;
    await act(async () => press().dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 1 })));
    expect(seen.at(-1)?.overview).toBe(true);
    await act(async () => press().dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 2 })));
    const landed = seen.at(-1)!;
    expect(landed.overview).toBe(false);
    expect(landed.focusId).toBe("aggregate:task");
    expect(landed.within?.["view"]).toBe("the-month");
    await unmount();
  });

  it("takes the second press of a double-click wherever the camera's flight left it, and keeps it from what is under it now", async () => {
    const seen: ViewState[] = [];
    const { host, unmount } = await mounted({ ...EMPTY_VIEW, overview: true }, (next) => seen.push(next));
    // What the flight put under the pointer: the district's own card, here a stand-in that records what reaches it.
    const under = document.createElement("div");
    document.body.appendChild(under);
    const reached: string[] = [];
    for (const type of ["pointerdown", "click", "dblclick"]) under.addEventListener(type, () => reached.push(type));
    await act(async () => host.querySelector('[data-testid="showing-the-month"]')!.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 1 })));
    expect(seen.at(-1)?.overview).toBe(true);
    await act(async () => {
      under.dispatchEvent(new Event("pointerdown", { bubbles: true }));
      under.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 2 }));
      under.dispatchEvent(new MouseEvent("dblclick", { bubbles: true, detail: 2 }));
    });
    const landed = seen.at(-1)!;
    expect(landed.overview).toBe(false);
    expect(landed.focusId).toBe("aggregate:task");
    expect(landed.within?.["view"]).toBe("the-month");
    expect(reached).toEqual([]);
    under.remove();
    await unmount();
  });

  it("goes down when the showing already on the billboard is pressed again, as a second Enter or a second tap does", async () => {
    const seen: ViewState[] = [];
    const { host, unmount } = await mounted({ ...EMPTY_VIEW, overview: true, focusId: "aggregate:task", within: { view: "the-week" } }, (next) => seen.push(next), true);
    const press = host.querySelector<HTMLButtonElement>('[data-testid="showing-the-week"]')!;
    expect(press.getAttribute("aria-pressed")).toBe("true");
    await act(async () => press.click());
    const landed = seen.at(-1)!;
    expect(landed.overview).toBe(false);
    expect(landed.focusId).toBe("aggregate:task");
    expect(landed.within?.["view"]).toBe("the-week");
    await unmount();
  });
});
