// @vitest-environment jsdom
/* React's act() wants to know it is in a test environment. */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { bindSchema, createSchema, defineNode, Store } from "@graview/core";
import { EMPTY_VIEW, type ViewState } from "@graview/layout";
import { GraviewProvider, createViews } from "@graview/react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { BackOut, registerDefaultViews } from "../../src/index.js";

/**
 * ESCAPE IS A LADDER, AND ITS TOP RUNG MUST NOT SWALLOW THE REST.
 *
 * An app that opens from altitude — what `graview create` writes, and what
 * any app with no in-stack default gets — is already home up there. The
 * provider deliberately lands a focusless descent back on the overview, so
 * the overview rung of the ladder moved nothing AND fell through to nothing:
 * from the first screen of every scaffolded app, Escape did not drop the
 * selection, did not undo a move and did not lower a raised relation. It did
 * nothing at all, in every state.
 */
const item = defineNode("item", {
  description: "A thing.",
  fields: z.object({ label: z.string() }),
  plural: "Items",
  label: (node) => node.label,
});
const schema = createSchema([item]);
const { defineMutation } = bindSchema(schema);
const add = defineMutation("add-item", {
  title: "Add an item",
  creates: ["item"],
  input: z.object({ label: z.string().min(1) }),
  apply(ctx, args) {
    ctx.addNode({ id: ctx.freshId(args.label, "item"), kind: "item", label: args.label });
  },
});

/**
 * Mounts BackOut over a view the test drives, and returns the presses.
 * `between` runs after each press, the way a popover's own listener would.
 */
async function ladder(home: ViewState, start: ViewState, presses: number, between?: (press: number) => void) {
  const store = new Store({ schema, mutations: [add], invariants: [] });
  store.apply({ name: "add-item", args: { label: "First thing" } });
  const views = registerDefaultViews(schema, createViews(schema));
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const seen: ViewState[] = [];
  let current = start;
  const draw = () =>
    act(() => {
      root.render(
        <GraviewProvider
          store={store}
          views={views}
          initialView={home}
          view={current}
          onViewChange={(next) => {
            current = next;
          }}
        >
          <BackOut home={home.focusId ?? null} />
        </GraviewProvider>,
      );
    });
  await draw();
  for (let i = 0; i < presses; i += 1) {
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    between?.(i);
    await draw();
    seen.push(current);
  }
  root.unmount();
  host.remove();
  return seen;
}

const ALTITUDE_HOME: ViewState = { ...EMPTY_VIEW, overview: true };

describe("Escape, from an app that opens at altitude", () => {
  it("drops the selection rather than doing nothing", async () => {
    const [first] = await ladder(
      ALTITUDE_HOME,
      { ...ALTITUDE_HOME, selection: ["kind:item"] },
      1,
    );
    expect(first?.overview).toBe(true);
    expect(first?.selection ?? []).toEqual([]);
  });

  it("takes the moves off the picture on the way down the ladder", async () => {
    const seen = await ladder(
      ALTITUDE_HOME,
      { ...ALTITUDE_HOME, selection: ["kind:item"], pins: { "kind:item": { x: 40, y: 12 } } },
      2,
    );
    expect(seen[0]?.selection ?? []).toEqual([]);
    expect(Object.keys(seen[0]?.pins ?? {})).toEqual(["kind:item"]);
    expect(Object.keys(seen[1]?.pins ?? {})).toEqual([]);
    expect(seen[1]?.overview).toBe(true);
  });

  it("never leaves altitude, because altitude is where this app lives", async () => {
    const seen = await ladder(ALTITUDE_HOME, { ...ALTITUDE_HOME, selection: ["kind:item"] }, 4);
    expect(seen.map((view) => view.overview)).toEqual([true, true, true, true]);
  });
});

describe("Escape, from an app that opens in the stack", () => {
  const STACK_HOME: ViewState = { ...EMPTY_VIEW, focusId: "kind:item" };

  it("still comes down from altitude first, keeping the selection", async () => {
    const seen = await ladder(
      STACK_HOME,
      { ...STACK_HOME, overview: true, selection: ["kind:item"] },
      2,
    );
    expect(seen[0]?.overview).toBe(false);
    expect(seen[0]?.selection ?? []).toEqual(["kind:item"]);
    expect(seen[1]?.selection ?? []).toEqual([]);
  });
});

describe("Escape, with a popover open over the scene", () => {
  /*
   * ONE PRESS, ONE RUNG. The activity rail, the problems list and the chat
   * each close on Escape with a listener of their own — and the ladder ran
   * too, so a single press closed the rail AND dropped the selection under
   * it, or backed out of the focus on the ground. A popover marks itself
   * `data-graview-overlay` while it is open, and the ladder leaves that
   * press to it.
   */
  it("leaves the press to the popover, and takes the next one", async () => {
    const popover = document.createElement("aside");
    popover.setAttribute("data-graview-overlay", "");
    document.body.append(popover);
    const seen = await ladder(
      ALTITUDE_HOME,
      { ...ALTITUDE_HOME, selection: ["kind:item"] },
      2,
      // The popover's own listener closes it on the first press.
      (press) => {
        if (press === 0) popover.remove();
      },
    );
    expect(seen[0]?.selection ?? [], "the first press was the popover's").toEqual(["kind:item"]);
    expect(seen[1]?.selection ?? [], "the second press drops the selection").toEqual([]);
  });
});
