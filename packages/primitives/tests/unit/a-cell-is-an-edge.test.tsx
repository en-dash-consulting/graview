import { createSchema, defineNode, Store } from "@graview/core";
import { EMPTY_VIEW } from "@graview/layout";
import { createViews, GraviewProvider } from "@graview/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createCoverageLens, registerDefaultViews } from "../../src/index.js";

/**
 * A COVERAGE CELL IS AN EDGE, lit when the selection reaches both ends.
 * Selecting Cobalt reaches the theme "night"; lit on either end, every
 * other song about night lit its night cell too.
 */
const song = defineNode("song", { fields: z.object({ label: z.string() }), plural: "Songs", label: (node) => node.label, edges: { about: { to: ["theme"] } } });
const theme = defineNode("theme", { fields: z.object({ label: z.string() }), plural: "Themes", label: (node) => node.label });
const schema = createSchema([song, theme]);

describe("a coverage cell under a selection", () => {
  it("is lit for the selected song's own ties, and dimmed for other songs on the same theme", () => {
    const store = new Store({
      schema,
      mutations: [],
      invariants: [],
      snapshot: {
        nodes: [
          { id: "cobalt", kind: "song", label: "Cobalt" },
          { id: "blue-hour", kind: "song", label: "Blue Hour" },
          { id: "night", kind: "theme", label: "night" },
        ] as never,
        edges: [
          { kind: "about", from: "cobalt", to: "night" },
          { kind: "about", from: "blue-hour", to: "night" },
        ],
      },
    });
    const lens = createCoverageLens({ rows: "song", columns: "theme", link: "about" });
    const View = lens.View as unknown as (props: Record<string, unknown>) => JSX.Element;
    const html = renderToStaticMarkup(
      <GraviewProvider store={store} views={registerDefaultViews(schema, createViews(schema))} initialView={EMPTY_VIEW}>
        <View nodes={store.graph.nodesOfKind("song")} fidelity="full" cardinality="many" mode="captured" selected={false} implicated={["cobalt", "night"]} />
      </GraviewProvider>,
    );
    const cells = [...html.matchAll(/data-graview-pick="night" data-graview-emphasis="(\w+)"[^>]*title="night answers ([^"]+)"/g)].map((match) => `${match[2]}:${match[1]}`);
    expect(cells.sort()).toEqual(["Blue Hour:dimmed", "Cobalt:lit"]);
  });
});
