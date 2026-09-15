// @vitest-environment jsdom
import { createSchema, defineNode, Store } from "@graview/core";
import { EMPTY_VIEW } from "@graview/layout";
import { createViews, GraviewProvider } from "@graview/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { RelationKey, registerDefaultViews } from "../../src/index.js";

/**
 * THE RELATION KEY STAYS INSIDE ITS OWN RAIL.
 *
 * The scene reserves a left rail for the key and the panes beside it —
 * `min(264, width * 0.22)`, in proportion, because an embed a paragraph wide
 * cannot give a third of itself to chrome — and the key was sized in fixed
 * pixels. The two agree only on a wide screen: below about 740px of scene
 * the key is wider than the rail it was given, and whatever the layout drew
 * at the left edge of the focus band ended up underneath it. A product in a
 * 700x520 embed had a panel's title clipped to "…nds" by this card.
 *
 * Measured in this repository's own apps the key is 130px and the rail at
 * 700px is 154, so nothing overlapped here — which is exactly why it went
 * unnoticed: it takes a domain whose edge names are long enough to grow the
 * card, and the framework's examples have short ones.
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
  it("caps itself against the rail's own formula rather than a fixed width", () => {
    const html = drawn();
    expect(html).toContain('data-testid="relation-key"');
    /* The scene's rail is min(264, 22%); this is that, less its own offset. */
    expect(html).toContain("max(110px, calc(min(250px, 22%) - 32px))");
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
