// @vitest-environment jsdom
import { createSchema, defineNode, Store } from "@graview/core";
import { EMPTY_VIEW } from "@graview/layout";
import { createViews, GraviewProvider } from "@graview/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { RelationKey, registerDefaultViews } from "../../src/index.js";
import { KEY_PANE_WIDTH } from "../../src/relation-key.js";

/**
 * THE RELATION KEY IS AS WIDE AS THE KEY'S PANE, wherever it is drawn.
 *
 * It was capped against a left rail the scene reserved — `min(264, 22%)` —
 * and the rail is gone: the key stands in the Key's pane at the top right,
 * `min(280px, 100% - 28px)` wide. Drawn on its own (a host's page, the
 * desk) it keeps to that same measure, one number for both, so a long
 * relation's words wrap at the width they are read at in the pane.
 */
const plot = defineNode("plot", { fields: z.object({ label: z.string() }), plural: "Plots" });
const gardener = defineNode("gardener", {
  fields: z.object({ label: z.string() }),
  plural: "Gardeners",
  edges: {
    "is-responsible-for-the-upkeep-of": {
      to: ["plot"],
      description: "the ground they keep",
      inverse: "who keeps it",
    },
  },
});
const schema = createSchema([plot, gardener]);

const drawn = () =>
  renderToStaticMarkup(
    <GraviewProvider
      store={
        new Store({
          schema,
          mutations: [],
          snapshot: {
            nodes: [
              { id: "lawn", kind: "plot", label: "Back Lawn" },
              { id: "ada", kind: "gardener", label: "Ada" },
            ] as never,
            edges: [{ kind: "is-responsible-for-the-upkeep-of", from: "ada", to: "lawn" }],
          },
        })
      }
      views={registerDefaultViews(schema, createViews(schema))}
      initialView={{ ...EMPTY_VIEW, overview: true }}
    >
      <RelationKey />
    </GraviewProvider>,
  );

describe("the key at altitude", () => {
  it("caps itself at the Key's pane's own width, not a rail that is gone", () => {
    const html = drawn();
    expect(html).toContain('data-testid="relation-key"');
    expect(html).toContain(`max-width:${KEY_PANE_WIDTH}`);
    expect(KEY_PANE_WIDTH).toBe("min(280px, calc(100% - 28px))");
  });

  it("names a relation in its declaration's words and its two ends, never by the edge's name", () => {
    const html = drawn();
    expect(html).toContain("The ground they keep");
    expect(html).toContain("Gardeners → Plots");
    expect(html).not.toContain(">is-responsible-for-the-upkeep-of<");
  });

  it("is not drawn at all when the scene is not at altitude", () => {
    const html = renderToStaticMarkup(
      <GraviewProvider
        store={new Store({ schema, mutations: [], snapshot: { nodes: [], edges: [] } })}
        views={registerDefaultViews(schema, createViews(schema))}
        initialView={EMPTY_VIEW}
      >
        <RelationKey />
      </GraviewProvider>,
    );
    expect(html).not.toContain('data-testid="relation-key"');
  });
});
