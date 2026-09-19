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
 * its showings on its district card as real, labelled buttons; a kind
 * with only untitled defaults draws none; in the stack there is no
 * marquee at all. Pressing a showing focuses the kind with it and
 * descends in one gesture.
 */
const task = defineNode("task", { fields: z.object({ label: z.string() }), plural: "Tasks" });
const note = defineNode("note", { fields: z.object({ label: z.string() }), plural: "Notes" });
const schema = createSchema([task, note]);
const Week: ViewComponent<typeof schema> = () => <div>the week</div>;
const views = () =>
  registerDefaultViews(schema, createViews(schema))
    .register("task", { cardinality: "many", fidelity: "full" }, Week, { title: "The week" })
    .register("task", { cardinality: "many", fidelity: "full" }, Week, { title: "The month" });
const store = () =>
  new Store({ schema, snapshot: { nodes: [{ id: "t1", kind: "task", label: "Pay" }, { id: "n1", kind: "note", label: "A note" }] as never, edges: [] } });

(Element.prototype as { scrollTo?: unknown }).scrollTo = () => {};

async function mounted(view: ViewState, onView?: (next: ViewState) => void) {
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
        <Card nodes={at.graph.nodesOfKind("task" as never) as never} fidelity="glyph" cardinality="many" mode="card" selected={false} label="Tasks" />
        <NoteCard nodes={at.graph.nodesOfKind("note" as never) as never} fidelity="glyph" cardinality="many" mode="card" selected={false} label="Notes" />
      </GraviewProvider>,
    ),
  );
  return { host, unmount: () => act(async () => root.unmount()) };
}

describe("the marquee", () => {
  it("draws the showings as labelled buttons from altitude, and none for a kind with only untitled defaults", async () => {
    const { host, unmount } = await mounted({ ...EMPTY_VIEW, overview: true });
    const marquee = host.querySelector('[data-testid="drive-in-task"]')!;
    expect(marquee).not.toBeNull();
    // No stand-in screen: the marquee is the sign. A dark slab read as a broken picture.
    expect(marquee.querySelector(".graview-drive-in-screen")).toBeNull();
    const buttons = [...marquee.querySelectorAll("button")];
    expect(buttons.map((button) => button.getAttribute("aria-label"))).toEqual(["Tasks: The week", "Tasks: The month"]);
    expect(host.querySelector('[data-testid="drive-in-note"]')).toBeNull();
    await unmount();
  });

  it("draws no marquee in the stack", async () => {
    const { host, unmount } = await mounted(EMPTY_VIEW);
    expect(host.querySelector('[data-testid="drive-in-task"]')).toBeNull();
    await unmount();
  });

  it("focuses the kind with that showing and descends in one gesture", async () => {
    const seen: ViewState[] = [];
    const { host, unmount } = await mounted({ ...EMPTY_VIEW, overview: true }, (next) => seen.push(next));
    await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="showing-the-month"]')!.click());
    const landed = seen.at(-1)!;
    expect(landed.overview ?? false).toBe(false);
    expect(landed.focusId).toBe("aggregate:task");
    expect(landed.within?.["view"]).toBe("the-month");
    await unmount();
  });
});
