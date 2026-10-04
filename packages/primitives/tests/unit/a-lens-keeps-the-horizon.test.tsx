import type { JSX } from "react";
import { createSchema, defineNode, isCurrent, Store } from "@graview/core";
import { EMPTY_VIEW } from "@graview/layout";
import { createViews, GraviewProvider } from "@graview/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createBoardLens, createCoverageLens, registerDefaultViews } from "../../src/index.js";
import { gapWords, unaskedWords } from "../../src/lens/coverage.js";

/**
 * A LENS KEEPS THE SCENE'S HORIZON. The coverage of songs by theme read
 * every song in the graph, retired demos included, and headed itself "3
 * unanswered" — the three songs the district beside it called past.
 */
const song = defineNode("song", {
  fields: z.object({ label: z.string(), status: z.enum(["released", "demo"]) }),
  plural: "Songs",
  label: (node) => node.label,
  edges: { about: { to: ["theme"] }, "sung-at": { to: ["stage"] } },
  lifecycle: { field: "status", retired: ["demo"] },
});
const theme = defineNode("theme", { fields: z.object({ label: z.string() }), plural: "Themes", label: (node) => node.label });
const stage = defineNode("stage", { fields: z.object({ label: z.string(), x: z.number(), y: z.number() }), plural: "Stages", label: (node) => node.label });
const schema = createSchema([song, theme, stage]);
const store = () =>
  new Store({
    schema,
    mutations: [],
    invariants: [],
    snapshot: {
      nodes: [
        { id: "s-blue", kind: "song", label: "Blue Hour", status: "released" },
        { id: "s-tin", kind: "song", label: "Tin Roof", status: "demo" },
        { id: "t-night", kind: "theme", label: "night" },
        { id: "st-main", kind: "stage", label: "Main", x: 0.5, y: 0.5 },
      ] as never,
      edges: [
        { kind: "about", from: "s-blue", to: "t-night" },
        { kind: "sung-at", from: "s-tin", to: "st-main" },
      ],
    },
  });

function draw(lens: { View: unknown }, kind: "song" | "stage") {
  const held = store();
  const members = held.graph.nodesOfKind(kind).filter((node) => isCurrent(schema.tryDefinition(kind), node as never));
  const View = lens.View as (props: Record<string, unknown>) => JSX.Element;
  return renderToStaticMarkup(
    <GraviewProvider store={held} views={registerDefaultViews(schema, createViews(schema))} initialView={EMPTY_VIEW}>
      <View nodes={members} label="Lens" fidelity="full" cardinality="many" mode="scene" selected={false} />
    </GraviewProvider>,
  );
}

describe("a lens over a group", () => {
  it("draws the coverage's own kind as the members the horizon left", () => {
    const html = draw(createCoverageLens({ rows: "song", columns: "theme", link: "about" }), "song");
    expect(html).toContain("Blue Hour");
    expect(html).not.toContain("Tin Roof");
    expect(html).not.toMatch(/unanswered/);
  });

  it("does not seat a retired occupant on the board", () => {
    const html = draw(createBoardLens({ slots: "stage", x: "x", y: "y", fill: "sung-at", fillFrom: "occupant" } as never), "stage");
    expect(html).toContain("Main");
    expect(html).not.toContain("Tin Roof");
  });
});

describe("what the coverage says is missing (W-106)", () => {
  it("says it in the kinds' own words, never a tender's", () => {
    const about = { rows: "song", columns: "theme", link: "about" };
    expect(gapWords(3, about, schema)).toBe("3 songs with no theme");
    expect(gapWords(1, about, schema)).toBe("1 song with no theme");
    expect(unaskedWords(2, about, schema)).toBe("2 themes on no song");
    const together = { rows: "artist", columns: "artist", link: { path: ["features", "by"] } };
    expect(gapWords(5, together, schema)).toBe("5 with none across");
    expect(unaskedWords(2, together, schema)).toBe("2 with none down");
  });

  it("heads the matrix with them", () => {
    const html = draw(createCoverageLens({ rows: "theme", columns: "song", link: "about" }), "song");
    expect(html).not.toMatch(/unanswered|unasked/);
  });
});
