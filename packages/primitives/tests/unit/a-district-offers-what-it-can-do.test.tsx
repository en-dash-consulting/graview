// @vitest-environment jsdom
/* React's act() wants to know it is in a test environment. */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { createSchema, defineNode, Store } from "@graview/core";
import { aggregateId, EMPTY_VIEW } from "@graview/layout";
import { createViews, GraviewProvider, Scene, type ViewComponent } from "@graview/react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { registerDefaultViews } from "../../src/index.js";

/**
 * A DISTRICT OFFERS ONLY WHAT IT CAN ACTUALLY DO.
 *
 * The layout refuses to open the district of the kind in focus: its members
 * are already the picture above, at size, and drawing the same ten names
 * twice is the one thing the ring exists to avoid.
 *
 * The card offered it anyway. Pressing "open" on Shifts while looking at the
 * week wrote `expand=kind:shift` into the stop, the next frame threw it
 * away, the card still read "open ▾", and nothing moved — so the control
 * looked broken rather than declined. A button that cannot do its own job is
 * worse than no button; saying where the members are is the honest answer.
 */
const shift = defineNode("shift", {
  fields: z.object({ label: z.string() }),
  plural: "Shifts",
  label: (node: { label: string }) => node.label,
});
const volunteer = defineNode("volunteer", {
  fields: z.object({ label: z.string() }),
  plural: "Volunteers",
  label: (node: { label: string }) => node.label,
});
const schema = createSchema([shift, volunteer]);

const host = document.createElement("div");
document.body.append(host);
const root = createRoot(host);
afterEach(async () => {
  await act(async () => root.render(null));
});

/** A picture of its own, so the group is not "plain" and keeps its card. */
const TheWeek = (() => <div>The week</div>) as ViewComponent<typeof schema>;

const city = async (focusId: string | null) => {
  const store = new Store({
    schema,
    mutations: [],
    invariants: [],
    snapshot: {
      nodes: [
        { id: "s1", kind: "shift", label: "Monday open up" },
        { id: "s2", kind: "shift", label: "Tuesday craft group" },
        { id: "v1", kind: "volunteer", label: "Ada Nowak" },
      ] as never,
      edges: [],
    },
  });
  await act(async () => {
    root.render(
      <GraviewProvider
        store={store}
        views={registerDefaultViews(schema, createViews(schema)).register(
          "shift",
          { cardinality: "many", fidelity: "full" },
          TheWeek,
          { title: "The week" },
        )}
        initialView={{ ...EMPTY_VIEW, overview: true, ...(focusId ? { focusId } : {}) }}
      >
        <Scene renderer="dom" />
      </GraviewProvider>,
    );
  });
};

const card = (kind: string) => host.querySelector(`[data-graview-view="kind:${kind}"]`);

describe("the district of the kind in focus", () => {
  it("says where its members are instead of offering to open", async () => {
    await city(aggregateId("shift"));
    const shifts = card("shift")!;
    expect(shifts.querySelectorAll(".graview-kind-open")).toHaveLength(0);
    expect(shifts.textContent).toContain("shown above");

    // Every other district is untouched: this is about the one in focus.
    const volunteers = card("volunteer")!;
    expect(volunteers.querySelectorAll(".graview-kind-open")).toHaveLength(1);
    expect(volunteers.textContent).not.toContain("shown above");
  });

  it("does not offer to close the district it opened in place either", async () => {
    /*
     * The other half of the same rule: a group whose picture is only the
     * framework's own list IS its district, opened. The layout re-opens it
     * on every frame, so a "close" control would be the same lie in the
     * other direction.
     */
    await city(aggregateId("volunteer"));
    const volunteers = card("volunteer")!;
    expect(volunteers.querySelectorAll(".graview-kind-open")).toHaveLength(0);
    expect(volunteers.textContent).toContain("Ada Nowak");
  });

  it("offers to open like any other district when it is not the focus", async () => {
    await city(null);
    for (const kind of ["shift", "volunteer"]) {
      expect(card(kind)!.querySelectorAll(".graview-kind-open"), kind).toHaveLength(1);
      expect(card(kind)!.textContent, kind).not.toContain("shown above");
    }
  });
});
