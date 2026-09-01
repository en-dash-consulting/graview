import { createSchema, defineNode, Store } from "@graview/core";
import { aggregateId, EMPTY_VIEW } from "@graview/layout";
import { GraviewProvider, createViews } from "@graview/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { QuickRelations, registerDefaultViews } from "../../src/index.js";

/**
 * The people behind a view, one press away — derived from the edges, small
 * kinds only, ranked by touch, capped. No app configuration anywhere.
 */

const person = defineNode("person", {
  fields: z.object({ label: z.string() }),
  plural: "People",
  edges: { "assigned-to": { to: ["duty"], description: "who does the run" } },
});
const duty = defineNode("duty", { fields: z.object({ label: z.string() }), plural: "Runs" });
const tag = defineNode("tag", {
  fields: z.object({ label: z.string() }),
  plural: "Tags",
  edges: { marks: { to: ["duty"], description: "what it marks" } },
});
const schema = createSchema([person, duty, tag]);

const store = (extraTags = 0) => {
  const nodes: Record<string, unknown>[] = [
    { id: "ana", kind: "person", label: "Ana" },
    { id: "bo", kind: "person", label: "Bo" },
    { id: "morning", kind: "duty", label: "Morning run" },
    { id: "evening", kind: "duty", label: "Evening run" },
  ];
  const edges = [
    { kind: "assigned-to", from: "ana", to: "morning" },
    { kind: "assigned-to", from: "ana", to: "evening" },
    { kind: "assigned-to", from: "bo", to: "evening" },
  ];
  for (let i = 0; i < extraTags; i++) {
    nodes.push({ id: `t${i}`, kind: "tag", label: `Tag ${i}` });
    edges.push({ kind: "marks", from: `t${i}`, to: "morning" });
  }
  return new Store({ schema, mutations: [], invariants: [], snapshot: { nodes, edges } as never });
};

const render = (theStore: ReturnType<typeof store>, view = { ...EMPTY_VIEW, focusId: aggregateId("duty") }) =>
  renderToStaticMarkup(
    <GraviewProvider
      store={theStore}
      views={registerDefaultViews(schema, createViews(schema))}
      initialView={view}
    >
      <QuickRelations />
    </GraviewProvider>,
  );

describe("quick-view relations", () => {
  it("offers the people one edge from the focused group, busiest first", () => {
    const html = render(store());
    expect(html).toContain('data-testid="quick-relations"');
    expect(html).toContain("People");
    // Ana touches two of the visible runs, Bo one — Ana leads.
    expect(html.indexOf("Ana")).toBeLessThan(html.indexOf("Bo"));
    expect(html).toContain('data-graview-quick="ana"');
  });

  it("says nothing for a crowd — a big kind already has a district", () => {
    const html = render(store(9));
    expect(html).not.toContain("Tags");
    expect(html).toContain("People");
  });

  it("stays out of the overview, where the legend owns the corner", () => {
    const html = render(store(), { ...EMPTY_VIEW, focusId: aggregateId("duty"), overview: true });
    expect(html).toBe("");
  });

  it("shows one kind only — the busiest — dressed as a placed panel", () => {
    // Tags (three members, one touch each) lose to People on reach.
    const html = render(store(3));
    expect(html).toContain("People");
    expect(html).not.toContain("Tags");
  });

  it("cuts a sentence-length name to a handle, keeping the whole on hover", () => {
    const wordy = new Store({
      schema,
      mutations: [],
      invariants: [],
      snapshot: {
        nodes: [
          { id: "r1", kind: "person", label: "Both parents get 11:00–13:30 free on their solo day" },
          { id: "morning", kind: "duty", label: "Morning run" },
        ] as never,
        edges: [{ kind: "assigned-to", from: "r1", to: "morning" }],
      },
    });
    const html = render(wordy);
    expect(html).toContain("Both parents get…");
    expect(html).toContain("Both parents get 11:00–13:30 free on their solo day — 1 of");
    expect(html).not.toContain(">Both parents get 11:00");
  });

  it("stands aside while anything is selected — the rail has one tenant", () => {
    const html = renderToStaticMarkup(
      <GraviewProvider
        store={store()}
        views={registerDefaultViews(schema, createViews(schema))}
        initialView={{ ...EMPTY_VIEW, focusId: aggregateId("duty") }}
        initialSelection={["ana"]}
      >
        <QuickRelations />
      </GraviewProvider>,
    );
    // The inspector owns the rail now; the chips return on deselect.
    expect(html).toBe("");
  });
});
