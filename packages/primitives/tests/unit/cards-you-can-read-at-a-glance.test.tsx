import { createSchema, defineApp, defineNode, Store, z } from "@graview/core";
import { EMPTY_VIEW } from "@graview/layout";
import { registerDefaultViews, registerViewSpecs, SPEC_VIEW_CSS } from "@graview/primitives";
import { createViews, GraviewProvider, type ViewProps } from "@graview/react";
import type { ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

/**
 * CARDS YOU CAN READ AT A GLANCE (the Roadmap's f-glanceable-cards).
 *
 * A card that printed a thirty-line summary made a row of cards a wall of
 * text, each stretched to the tallest beside it; a row's "0 votes" was a
 * badge saying there was nothing to say. A long text is three lines on a
 * card and one on a row, a card keeps its own height, and a count of
 * nothing is no badge.
 */
const feature = defineNode("feature", { fields: z.object({ name: z.string(), summary: z.string().max(5000), votes: z.number() }) });
const schema = createSchema([feature]);
const app = defineApp({
  name: "Roadmap",
  schema,
  viewSpecs: {
    feature: {
      card: [{ title: "{name}" }, { badge: "{votes} {votes | plural: 'vote'}" }, { text: "{summary}" }],
      row: [{ title: "{name}" }, { badge: "{votes} {votes | plural: 'vote'}" }, { text: "{summary|excerpt}" }],
    },
  },
});
const SUMMARY = "Offline drafts keep what a person wrote when the network goes. Then thirty more lines of what it is for.";

function draw(fidelity: "summary" | "glyph", votes: number) {
  const store = new Store({ schema, mutations: [], snapshot: { nodes: [{ id: "f1", kind: "feature", name: "Offline drafts", summary: SUMMARY, votes }] as never, edges: [] } });
  const registry = registerViewSpecs(registerDefaultViews(schema, createViews(schema)), schema, app.viewSpecs);
  const View = registry.lookup("feature", { cardinality: "one", fidelity }) as ComponentType<ViewProps<typeof schema>>;
  return renderToStaticMarkup(
    <GraviewProvider store={store} views={registry} initialView={EMPTY_VIEW}>
      <View node={store.graph.getNode("f1") as never} cardinality="one" fidelity={fidelity} mode="scene" selected={false} />
    </GraviewProvider>,
  );
}

describe("a card and a row", () => {
  it("clamp a long text to three lines on a card and one on a row", () => {
    expect(SPEC_VIEW_CSS).toContain(".graview-spec-card .graview-spec-text,.graview-spec-card .graview-spec-value{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:3");
    expect(SPEC_VIEW_CSS).toContain(".graview-spec-row .graview-spec-text,.graview-spec-row .graview-spec-value{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:1");
  });

  it("keep their own heights side by side", () => {
    expect(SPEC_VIEW_CSS).toMatch(/\.graview-spec-list\[data-as="card"\]\{[^}]*align-items:start/);
  });

  it("say a row's excerpt, the first sentence", () => {
    const row = draw("glyph", 2);
    expect(row).toContain("Offline drafts keep what a person wrote when the network goes.");
    expect(row).not.toContain("thirty more lines");
  });

  it("draw a count as a badge, and a count of nothing as no badge", () => {
    expect(draw("summary", 1)).toContain(">1 vote<");
    expect(draw("summary", 2)).toContain(">2 votes<");
    const none = draw("summary", 0);
    expect(none).not.toContain("0 votes");
    expect(none).not.toContain("graview-spec-badge");
  });
});
