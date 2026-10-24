// @vitest-environment jsdom
/* React's act() wants to know it is in a test environment. */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { createSchema, defineNode, Store } from "@graview/core";
import { EMPTY_VIEW, withFocus, withOverview, type ViewState } from "@graview/layout";
import { withPan } from "@graview/layout/view-moves";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { createViews, GraviewProvider, PanFree, useGraview } from "../../src/index.js";

/**
 * WHAT FLOATS OVER THE PICTURE IS NOT TOLD THE PAN.
 *
 * The pan is part of the view, and the view is part of the context, so
 * letting go of a drag drew every card in the scene and every record the
 * panel beside the map lists again, to show them nothing new. Inside
 * `PanFree` the context is kept while only the pan moves; anything else
 * that changes still reaches what reads it. And a write of the whole view
 * from in there — which never saw the pan — keeps the camera where it is.
 */
const note = defineNode("note", { fields: z.object({ label: z.string() }), plural: "Notes" });
const schema = createSchema([note]);
const store = new Store({
  schema,
  mutations: [],
  snapshot: { nodes: [{ id: "n1", kind: "note", label: "First" }, { id: "n2", kind: "note", label: "Second" }], edges: [] },
});
const views = createViews(schema);

let drawn = 0;
let seen: ViewState | null = null;
let write: ((next: ViewState) => void) | null = null;
function Card() {
  const { view, setView } = useGraview();
  drawn += 1;
  seen = view;
  write = setView;
  return null;
}
let outer: ReturnType<typeof useGraview> | null = null;
function Outside() {
  outer = useGraview();
  return null;
}

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  drawn = 0;
  act(() =>
    root.render(
      <GraviewProvider store={store} views={views} initialView={withOverview(EMPTY_VIEW, true)}>
        <Outside />
        <PanFree>
          <Card />
        </PanFree>
      </GraviewProvider>,
    ),
  );
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe("PanFree", () => {
  it("draws nothing inside it again when only the pan moves", () => {
    const before = drawn;
    act(() => outer!.setView((current) => withPan(current, { x: 140, y: -60 })));
    act(() => outer!.setView((current) => withPan(current, { x: 300, y: 20 })));
    expect(outer!.view.pan).toEqual({ x: 300, y: 20 });
    expect(drawn).toBe(before);
  });

  it("hands what is inside it the view without the pan", () => {
    act(() => outer!.setView((current) => withPan(current, { x: 140, y: -60 })));
    act(() => outer!.setView((current) => withFocus(current, "n2")));
    expect(seen!.focusId).toBe("n2");
    expect(seen!.pan).toBeUndefined();
  });

  it("still draws what is inside it again when anything else changes", () => {
    const before = drawn;
    act(() => outer!.setSelection(["n1"]));
    expect(drawn).toBeGreaterThan(before);
    expect(seen!.selection).toEqual(["n1"]);
  });

  it("keeps the camera where it is when a card writes the whole view", () => {
    act(() => outer!.setView((current) => withPan(current, { x: 140, y: -60 })));
    // A card's own write, from the view it was handed: no pan in it.
    act(() => write!({ ...seen!, q: "second" }));
    expect(outer!.view.q).toBe("second");
    expect(outer!.view.pan).toEqual({ x: 140, y: -60 });
  });

  it("keeps a pan a card says of its own", () => {
    act(() => outer!.setView((current) => withPan(current, { x: 140, y: -60 })));
    act(() => write!({ ...seen!, pan: { x: 5, y: 6 } }));
    expect(outer!.view.pan).toEqual({ x: 5, y: 6 });
  });
});
