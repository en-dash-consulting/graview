import { createSchema, defineNode, isoDate, Store } from "@graview/core";
import { aggregateId, EMPTY_VIEW, type ViewState } from "@graview/layout";
import { createViews, GraviewProvider } from "@graview/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createBoardLens, createCalendarLens, createTimelineLens } from "../../src/index.js";

/**
 * A lens arranges before it draws. The arrangement travels in the stop
 * beside the calendar's own month, so a filtered board or a grouped agenda
 * is a link and Back restores it; each lens offers only the parts it has a
 * place for, and an app declines the rest.
 */
const seat = defineNode("seat", { fields: z.object({ label: z.string(), code: z.string(), x: z.number(), y: z.number() }), edges: { "taken-by": { to: ["guest"] } } });
const guest = defineNode("guest", { fields: z.object({ label: z.string(), vip: z.boolean(), from: z.number(), until: z.number(), day: z.string(), on: isoDate.optional() }), edges: { "with": { to: ["party"], description: "the party they came with", inverse: "who came with it" } } });
const party = defineNode("party", { fields: z.object({ label: z.string() }) });
const schema = createSchema([seat, guest, party]);
const nodes = [
  { id: "s1", kind: "seat", label: "Head", code: "1", x: 0.5, y: 0.1 },
  { id: "s2", kind: "seat", label: "Side", code: "2", x: 0.2, y: 0.5 },
  { id: "g-ada", kind: "guest", label: "Ada", vip: true, from: 60, until: 120, day: "mon", on: "2026-09-01" },
  { id: "g-bram", kind: "guest", label: "Bram", vip: false, from: 130, until: 200, day: "mon", on: "2026-09-02" },
  { id: "g-cleo", kind: "guest", label: "Cleo", vip: true, from: 210, until: 260, day: "mon", on: "2026-09-02" },
  { id: "p-north", kind: "party", label: "The north table" },
  { id: "p-south", kind: "party", label: "The south table" },
];
const edges = [
  { kind: "taken-by", from: "s1", to: "g-ada" },
  { kind: "taken-by", from: "s1", to: "g-cleo" },
  { kind: "taken-by", from: "s2", to: "g-bram" },
  { kind: "with", from: "g-ada", to: "p-north" },
  { kind: "with", from: "g-bram", to: "p-south" },
  { kind: "with", from: "g-cleo", to: "p-north" },
];
const store = () => new Store({ schema, mutations: [], invariants: [], snapshot: { nodes, edges } as never });
const draw = (element: React.ReactElement, view: ViewState) =>
  renderToStaticMarkup(
    <GraviewProvider store={store()} views={createViews(schema)} initialView={view}>
      {element}
    </GraviewProvider>,
  );
const picks = (html: string) => [...html.matchAll(/data-graview-pick="([^"]+)"/g)].map((match) => match[1]);
const guests = (html: string) => picks(html).filter((id) => id.startsWith("g-"));

describe("the board", () => {
  const lens = createBoardLens<typeof schema>({ slots: "seat", x: "x", y: "y", fill: "taken-by", slotCode: "code" });
  const view = (within: Record<string, string>) => ({ ...EMPTY_VIEW, focusId: aggregateId("seat"), within });
  const board = (within: Record<string, string>, fidelity: "full" | "summary" = "full") =>
    draw(<lens.View nodes={nodes as never} fidelity={fidelity} cardinality="many" mode="scene" selected={false} />, view(within));

  it("draws the row for the occupants, without a place to group", () => {
    const html = board({});
    expect(html).toContain('data-testid="arrange-bar"');
    expect(html).toContain('data-testid="arrange-sort"');
    expect(html).not.toContain('data-testid="arrange-group"');
    // Not at summary fidelity: the arrangement holds, the row does not fit.
    expect(board({}, "summary")).not.toContain('data-testid="arrange-bar"');
  });

  it("filters the occupants and keeps every slot; sorts within a slot", () => {
    const vip = board({ filter: "vip:true" });
    expect(guests(vip).sort()).toEqual(["g-ada", "g-cleo"]);
    expect(picks(vip)).toContain("s2");
    expect(vip).toContain("2 of 3");
    const sorted = board({ sort: "label:desc" });
    const head = sorted.indexOf('data-graview-pick="g-cleo"');
    expect(head).toBeGreaterThan(-1);
    expect(head).toBeLessThan(sorted.indexOf('data-graview-pick="g-ada"'));
  });

  it("is declined by the app", () => {
    const quiet = createBoardLens<typeof schema>({ slots: "seat", x: "x", y: "y", fill: "taken-by", slotCode: "code", arranging: false });
    const html = draw(<quiet.View nodes={nodes as never} fidelity="full" cardinality="many" mode="scene" selected={false} />, view({ filter: "vip:true" }));
    expect(html).not.toContain('data-testid="arrange-bar"');
    expect(guests(html)).toHaveLength(3);
  });
});

describe("the timeline", () => {
  const lens = createTimelineLens<typeof schema>({
    bindings: { guest: { start: "from", end: "until", column: "day" } },
    columns: [{ id: "mon", label: "Monday" }],
    extent: 300,
  });
  const view = (within: Record<string, string>) => ({ ...EMPTY_VIEW, focusId: aggregateId("guest"), within });
  const guestsOnly = nodes.filter((node) => node.kind === "guest");

  it("filters its spans from the stop, and offers no grouping", () => {
    const all = draw(<lens.View nodes={guestsOnly as never} fidelity="full" cardinality="many" mode="scene" selected={false} />, view({}));
    expect(guests(all)).toHaveLength(3);
    expect(all).not.toContain('data-testid="arrange-group"');
    const north = draw(<lens.View nodes={guestsOnly as never} fidelity="full" cardinality="many" mode="scene" selected={false} />, view({ filter: "with:p-north" }));
    expect(guests(north).sort()).toEqual(["g-ada", "g-cleo"]);
    expect(north).toContain("The party they came with: The north table");
  });
});

describe("the calendar", () => {
  const lens = createCalendarLens<typeof schema>({ bindings: { guest: { start: "on" } }, today: "2026-09-01", arrangedBy: { filter: [{ key: "vip", value: "true" }] } });
  const view = (within: Record<string, string>) => ({ ...EMPTY_VIEW, focusId: aggregateId("guest"), within });
  const guestsOnly = nodes.filter((node) => node.kind === "guest");
  const calendar = (within: Record<string, string>) =>
    draw(<lens.View nodes={guestsOnly as never} fidelity="full" cardinality="many" mode="fullscreen" selected={false} />, view(within));

  it("opens arranged by what the app said, until the stop says otherwise", () => {
    const opened = calendar({});
    expect(guests(opened).sort()).toEqual(["g-ada", "g-cleo"]);
    expect(opened).toContain("Vip: yes");
    expect(guests(calendar({ filter: "is:any" }))).toHaveLength(3);
    // Sorting is the dates' business.
    expect(opened).not.toContain('data-testid="arrange-sort"');
  });

  it("groups the agenda, and only the agenda, by a far end", () => {
    const month = calendar({ group: "with", filter: "is:any" });
    expect(month).not.toContain('data-testid="calendar-group"');
    const agenda = calendar({ range: "agenda", group: "with", filter: "is:any" });
    const headings = [...agenda.matchAll(/data-testid="calendar-group"[\s\S]*?<h3[^>]*>([^<]*)</g)].map((match) => match[1]!.trim());
    expect(headings).toEqual(["The north table", "The south table"]);
    expect(agenda).toContain('data-testid="arrange-group"');
  });
});
