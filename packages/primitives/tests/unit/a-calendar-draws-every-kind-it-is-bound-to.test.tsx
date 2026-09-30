import { createSchema, defineNode, isoDate, Store } from "@graview/core";
import { aggregateId, EMPTY_VIEW } from "@graview/layout";
import { createViews, GraviewProvider } from "@graview/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createCalendarLens } from "../../src/index.js";

/**
 * A CALENDAR DRAWS EVERY KIND IT IS BOUND TO. A dealership's diary is bound
 * to test drives and service appointments and registered over the test
 * drives — and drew only the test drives: `nodes` is the group's members,
 * and the other bound kind was never read from the graph. "The lens reads
 * the whole graph, never only the group's members."
 */
const drive = defineNode("drive", { fields: z.object({ label: z.string(), on: isoDate, status: z.enum(["booked", "driven"]) }), lifecycle: { field: "status", retired: ["driven"] } });
const service = defineNode("service", { fields: z.object({ label: z.string(), on: isoDate, status: z.enum(["booked", "done"]) }), lifecycle: { field: "status", retired: ["done"] } });
const schema = createSchema([drive, service]);
const nodes = [
  { id: "d1", kind: "drive", label: "Ada in the Civic", on: "2026-09-30", status: "booked" },
  { id: "s1", kind: "service", label: "Oil change", on: "2026-09-30", status: "booked" },
  { id: "s2", kind: "service", label: "Brakes, done", on: "2026-09-29", status: "done" },
];
const lens = createCalendarLens<typeof schema>({ bindings: { drive: { start: "on" }, service: { start: "on" } }, today: "2026-09-30", range: "week" });
const draw = (past: boolean) =>
  renderToStaticMarkup(
    <GraviewProvider
      store={new Store({ schema, mutations: [], invariants: [], snapshot: { nodes, edges: [] } as never })}
      views={createViews(schema)}
      initialView={{ ...EMPTY_VIEW, focusId: aggregateId("drive"), ...(past ? { past: true } : {}) }}
    >
      <lens.View nodes={[nodes[0]] as never} fidelity="full" cardinality="many" mode="scene" selected={false} />
    </GraviewProvider>,
  );
const picks = (html: string) => [...html.matchAll(/data-graview-pick="([^"]+)"/g)].map((match) => match[1]);

describe("a calendar over one kind, bound to two", () => {
  it("draws the other bound kind from the graph, on the same horizon", () => {
    const html = draw(false);
    expect(picks(html)).toContain("d1");
    expect(picks(html)).toContain("s1");
    expect(picks(html), "a finished service is behind the horizon").not.toContain("s2");
  });

  it("draws the other kind's past when the stop asks for the past", () => {
    expect(picks(draw(true))).toContain("s2");
  });
});
