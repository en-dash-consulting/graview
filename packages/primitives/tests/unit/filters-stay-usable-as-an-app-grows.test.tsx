// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { createSchema, defineNode, Graph, type Arrangement } from "@graview/core";
import { arrangeable, throughEdges } from "@graview/core/arrange";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { ArrangeBar, chipOffers, MANY_AT_THE_FAR_END, offeredFilters, preloadArrangeLists, TYPED_FROM } from "../../src/index.js";
import { filterSections, typedMatches } from "../../src/arrange-lists.js";

await preloadArrangeLists();

/**
 * FILTERS THAT STAY USABLE AS AN APP GROWS (the Roadmap's f-filters-that-scale).
 *
 * A request's list on the Roadmap: Filter listed every one of ninety
 * features, wrapping, in a popover that ran off the screen. The list's
 * status stands over it as chips with counts, one press away; a relation
 * to a kind with many records is left out unless named, offered instead by
 * what is at its far end; a relation with more than eight records there is
 * found by typing; and every heading of the Filter list starts closed.
 */
const feature = defineNode("feature", { fields: z.object({ label: z.string(), stage: z.enum(["idea", "building", "shipped"]) }) });
const person = defineNode("person", { fields: z.object({ label: z.string() }), edges: { votes: { to: ["request"], description: "what they voted for", inverse: "who voted for it" } } });
const request = defineNode("request", {
  fields: z.object({ label: z.string(), status: z.enum(["new", "planned", "done"]) }),
  edges: { became: { to: ["feature"], description: "the feature it became", inverse: "the requests it answers" } },
});
const schema = createSchema([feature, person, request]);
const FEATURES = MANY_AT_THE_FAR_END + 10;
const nodes = [
  ...Array.from({ length: FEATURES }, (_, at) => ({ id: `f${at}`, kind: "feature", label: `Feature ${String(at).padStart(2, "0")}`, stage: ["idea", "building", "shipped"][at % 3] })),
  ...Array.from({ length: 12 }, (_, at) => ({ id: `p${at}`, kind: "person", label: `Person ${String.fromCharCode(65 + at)}` })),
  ...Array.from({ length: 9 }, (_, at) => ({ id: `r${at}`, kind: "request", label: `Request ${at}`, status: ["new", "planned", "done"][at % 3] })),
];
const edges = Array.from({ length: 9 }, (_, at) => ({ kind: "became", from: `r${at}`, to: `f${at}` }));
const graph = Graph.from(schema, { nodes, edges } as never);
const offers = throughEdges(schema, arrangeable(schema, "request"));

describe("what a list offers to filter by", () => {
  it("leaves out a relation to a kind with many records, and offers what is at its far end instead", () => {
    const keys = offeredFilters(offers, graph as never).map((offer) => offer.key);
    expect(keys).toContain("status");
    expect(keys).toContain("votes");
    expect(keys).not.toContain("became");
    expect(keys).toContain("became.stage");
  });

  it("is what the declaration names, in its order, when it names", () => {
    expect(offeredFilters(offers, graph as never, ["became", "status", "ghost"]).map((offer) => offer.key)).toEqual(["became", "status"]);
  });

  it("stands its first choice fields as chips, or the ones named", () => {
    expect(chipOffers(offeredFilters(offers, graph as never)).map((offer) => offer.key)).toEqual(["status"]);
    expect(chipOffers(offeredFilters(offers, graph as never, ["became.stage"]), ["became.stage"])).toEqual([]);
  });

  it("finds a relation's far records by typing past eight, at most eight matches, those that begin with it first", () => {
    const sections = filterSections(schema, graph as never, { ...offers, filters: offeredFilters(offers, graph as never, ["became", "votes"]) });
    const became = sections.find((section) => section.key === "became")!;
    expect(became.typed?.length).toBe(FEATURES);
    expect(became.entries.map((entry) => entry.label)).toEqual(["anything", "nothing"]);
    expect(TYPED_FROM).toBe(9);
    const found = typedMatches(became.typed!, "feature 1");
    expect(found.shown.length).toBe(8);
    expect(found.more).toBe(2);
    expect(typedMatches(became.typed!, "  ").shown).toEqual([]);
    // Twelve people is past eight too: found by typing.
    expect(sections.find((section) => section.key === "votes")?.typed?.length).toBe(12);
  });
});

let host: HTMLDivElement;
let root: Root;
let arrangement: Arrangement;
// Each test's line its own: a line remembers what it last sent, by its test id.
let line = "arrange";
const draw = (next: Arrangement = {}) => {
  arrangement = next;
  act(() =>
    root.render(
      <ArrangeBar
        schema={schema}
        graph={graph}
        kind="request"
        offers={offers}
        arrangement={arrangement}
        onChange={(changed) => draw(changed)}
        kept={{ shown: 9, of: 9 }}
        noun={{ one: "request", many: "requests" }}
        chips={{ nodes: graph.nodesOfKind("request") as never }}
        query={false}
        testId={line}
      />,
    ),
  );
};
const $ = (selector: string) => host.querySelector<HTMLElement>(selector.replaceAll('"arrange-', `"${line}-`));
const press = (element: HTMLElement | null) => act(() => element!.click());

beforeEach(() => {
  line = `line${Math.random().toString(36).slice(2, 8)}`;
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe("the list's line", () => {
  it("stands its status as chips with counts, one press narrows, another of the field takes its place, and again lets go", () => {
    draw();
    const chips = [...host.querySelectorAll<HTMLElement>(`[data-testid="${line}-chip"]`)];
    expect(chips.map((chip) => chip.textContent)).toEqual(["New3", "Planned3", "Done3"]);
    press($('[data-testid="arrange-chip"][data-value="status:planned"]'));
    expect(arrangement.filter).toEqual([{ key: "status", value: "planned" }]);
    expect($('[data-testid="arrange-chip"][data-value="status:planned"]')?.getAttribute("aria-pressed")).toBe("true");
    // What is on is a chip of its own beside the count, which takes itself off.
    expect($('[data-testid="arrange-count"]')?.nextElementSibling?.getAttribute("data-testid")).toBe(`${line}-condition`);
    press($('[data-testid="arrange-chip"][data-value="status:done"]'));
    expect(arrangement.filter).toEqual([{ key: "status", value: "done" }]);
    press($('[data-testid="arrange-chip"][data-value="status:done"]'));
    expect(arrangement.filter).toBeUndefined();
  });

  it("counts each chip among the rest of what is asked", () => {
    draw({ filter: [{ key: "became.stage", value: "building" }] });
    // Requests 1, 4 and 7 became a feature being built: planned, planned, planned.
    expect([...host.querySelectorAll<HTMLElement>(`[data-testid="${line}-chip"]`)].map((chip) => chip.textContent)).toEqual(["Planned3"]);
    expect($('[data-testid="arrange-condition"]')?.textContent).toContain("The feature it became · Stage: Building");
  });

  it("opens Filter short: a box to find with, every heading closed, and a heading opened lists its own", () => {
    draw();
    press($('[data-testid="arrange-add"]'));
    const pane = host.querySelector<HTMLElement>('[data-testid="arrange-list"]')!;
    expect(pane.querySelector(`[data-testid="${line}-filter-find"]`)).not.toBeNull();
    const headings = [...pane.querySelectorAll<HTMLElement>(`[data-testid="${line}-section"]`)];
    // The status is a chip, not a heading.
    expect(headings.map((heading) => heading.getAttribute("data-key"))).toEqual(["votes", "became.stage", "is"]);
    expect(headings.every((heading) => heading.getAttribute("aria-expanded") === "false")).toBe(true);
    expect(pane.querySelectorAll(".graview-arrange-item").length).toBe(0);
    press(headings[1]!);
    expect([...pane.querySelectorAll(".graview-arrange-item")].map((item) => item.getAttribute("data-value"))).toEqual(["became.stage:idea", "became.stage:building", "became.stage:shipped"]);
  });
});
