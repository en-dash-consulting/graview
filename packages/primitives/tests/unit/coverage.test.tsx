import { createSchema, defineNode, Store } from "@graview/core";
import { EMPTY_VIEW, aggregateId } from "@graview/layout";
import { GraviewProvider, Scene, createViews } from "@graview/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  buildCoverage,
  CoverageBindingError,
  createCoverageLens,
  registerDefaultViews,
} from "../../src/index.js";

/**
 * The lens knows nothing about bids. This fixture is deliberately a different
 * domain again — controls against risks, the shape an auditor works in —
 * because a lens that only works for the app it was written beside is not a
 * lens.
 */
const risk = defineNode("risk", {
  fields: z.object({ label: z.string(), severity: z.enum(["critical", "minor"]) }),
  plural: "Risks",
});
const control = defineNode("control", {
  fields: z.object({ label: z.string() }),
  edges: { mitigates: { to: ["risk"] } },
  plural: "Controls",
});
const policy = defineNode("policy", {
  fields: z.object({ label: z.string() }),
  edges: { documents: { to: ["risk"] } },
  plural: "Policies",
});
const schema = createSchema([risk, control, policy]);

const nodes = [
  { id: "r1", kind: "risk", label: "Data loss", severity: "critical" },
  { id: "r2", kind: "risk", label: "Vendor outage", severity: "critical" },
  { id: "r3", kind: "risk", label: "Stale docs", severity: "minor" },
  { id: "c1", kind: "control", label: "Nightly backups" },
  { id: "c2", kind: "control", label: "Screensaver lock" },
  { id: "p1", kind: "policy", label: "Continuity policy" },
] as never[];

const edges = [
  { kind: "mitigates", from: "c1", to: "r1" },
  { kind: "documents", from: "p1", to: "r1" },
];

const options = {
  rows: "risk",
  columns: "control",
  link: "mitigates",
  rowGroup: "severity",
  groupOrder: ["critical", "minor"],
  requiredGroups: ["critical"],
  badge: { edge: "documents", symbol: "§", title: "documented", missingTitle: "undocumented" },
} as const;

describe("the coverage lens", () => {
  it("declares the roles an app must bind", () => {
    expect(createCoverageLens(options).requiredRoles).toEqual(["rows", "columns", "link"]);
  });

  it("finds the row nothing covers — the reason it exists", () => {
    const grid = buildCoverage(nodes, edges, options, schema);
    expect(grid.gaps).toEqual(["r2"]);
  });

  it("finds the column that covers nothing — the other reason", () => {
    const grid = buildCoverage(nodes, edges, options, schema);
    expect(grid.unasked).toEqual(["c2"]);
  });

  it("does not call an uncovered OPTIONAL row a gap", () => {
    const grid = buildCoverage(nodes, edges, options, schema);
    // "Stale docs" is minor and uncovered, which is a decision rather than a
    // failure. Without required groups the picture cannot tell them apart.
    expect(grid.rows.find((row) => row.id === "r3")!.covered).toBe(false);
    expect(grid.gaps).not.toContain("r3");
  });

  it("groups rows in the order the app gave, not alphabetically", () => {
    const grid = buildCoverage(nodes, edges, options, schema);
    expect(grid.rows.map((row) => row.group)).toEqual([
      "critical",
      "critical",
      "minor",
    ]);
  });

  it("carries a second relation as a per-row badge rather than a second grid", () => {
    const grid = buildCoverage(nodes, edges, options, schema);
    expect(grid.rows.find((row) => row.id === "r1")!.badged).toBe(true);
    expect(grid.rows.find((row) => row.id === "r2")!.badged).toBe(false);
  });

  it("says which binding is wrong rather than drawing an empty grid", () => {
    expect(() =>
      buildCoverage(nodes, edges, { ...options, rows: "nope", columns: "alsonope" }, schema),
    ).toThrow(CoverageBindingError);
  });

  it("ignores an edge pointing the wrong way", () => {
    // The link runs column → row. A reversed edge is not a cell; silently
    // filling one would make the picture lie about who covers what.
    const grid = buildCoverage(nodes, [{ kind: "mitigates", from: "r1", to: "c1" }], options, schema);
    expect(grid.cells).toEqual([]);
  });
});

/*
 * WHAT A SELECTION LIGHTS IS A FACT, NOT A COLOUR.
 *
 * The row labels said their emphasis in the tree; the column heads and the
 * filled cells only painted it — so half the marks in the picture made a
 * claim nothing could check and a screen reader could not reach.
 */
describe("the grid says what it lights", () => {
  const render = (selection: readonly string[]) =>
    renderToStaticMarkup(
      <GraviewProvider
        store={new Store({ schema, mutations: [], invariants: [], snapshot: { nodes, edges } })}
        views={registerDefaultViews(schema, createViews(schema)).register(
          "risk",
          { cardinality: "many", fidelity: "full" },
          createCoverageLens({ rows: "risk", columns: "control", link: "mitigates" })
            .View as never,
          { title: "Covered" },
        )}
        initialView={{ ...EMPTY_VIEW, focusId: aggregateId("risk"), zoom: true }}
        initialSelection={selection}
      >
        <Scene renderer="dom" />
      </GraviewProvider>,
    );

  const marks = (html: string): string[] =>
    [...html.matchAll(/data-graview-emphasis="([a-z]+)"/g)].map((match) => match[1]!);

  it("says plain on every mark when nothing is selected", () => {
    const said = marks(render([]));
    // Rows, column heads and filled cells: every one of them, and all plain.
    expect(said.length).toBeGreaterThanOrEqual(6);
    expect(new Set(said)).toEqual(new Set(["plain"]));
  });

  it("lights and dims every mark once something is selected", () => {
    const said = marks(render(["c1"]));
    expect(said).toContain("lit");
    expect(said).toContain("dimmed");
    expect(said).not.toContain("plain");
  });
});
