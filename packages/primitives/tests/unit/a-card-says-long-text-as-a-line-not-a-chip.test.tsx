import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Store, type AnySchema, type GraviewApp } from "@graview/core";
import { compileDocument } from "@graview/core/check";
import { EMPTY_VIEW } from "@graview/layout";
import { registerDefaultViews } from "@graview/primitives";
import { createViews, GraviewProvider, type ViewProps } from "@graview/react";
import type { ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

/**
 * A DEFAULT CARD SAYS LONG TEXT AS A LINE, NOT A CHIP.
 *
 * An insight's thesis — Markdown, several paragraphs — was a chip on its
 * card, cut after a couple of dozen characters: "Every secret the app
 * hol…". Prose on a card is its start, the syntax taken out, on a line of
 * its own under the chips; the chips are the facts.
 */
const fixtures = resolve(import.meta.dirname, "../../../core/tests/document/fixtures");
const review = JSON.parse(readFileSync(resolve(fixtures, "review.gdd.json"), "utf8"));
const seed = JSON.parse(readFileSync(resolve(fixtures, "review.seed.json"), "utf8"));
const compiled = compileDocument(review, { today: () => "2026-10-15" });
if (!compiled.ok) throw new Error("the review did not compile");
const app = compiled.app as GraviewApp<AnySchema>;

function card(id: string): string {
  const store = new Store<AnySchema>({ schema: app.schema, mutations: app.mutations ?? [], ...(app.policy ? { policy: app.policy } : {}), snapshot: seed });
  const node = store.graph.getNode(id)!;
  const registry = registerDefaultViews(app.schema, createViews(app.schema));
  const View = registry.lookup(node.kind as never, { cardinality: "one", fidelity: "summary" }) as ComponentType<ViewProps<AnySchema>>;
  return renderToStaticMarkup(
    <GraviewProvider store={store} views={registry} initialView={EMPTY_VIEW}>
      <View node={node as never} cardinality="one" fidelity="summary" mode="scene" selected={false} />
    </GraviewProvider>,
  );
}

describe("an insight's card", () => {
  it("says its thesis by its start on a line of its own, Markdown's syntax taken out", () => {
    const drawn = card("i1");
    expect(drawn).toMatch(/<p data-graview-excerpt="thesis"[^>]*>Every secret the app holds reaches three layers further than it needs to: the logger, the error reporter and the cache\.<\/p>/);
    expect(drawn).not.toContain("**");
  });

  it("keeps its chips for its facts: its strength is a chip, its thesis is not", () => {
    const drawn = card("i1");
    const chips = drawn.split("<p data-graview-excerpt")[0]!;
    expect(chips).toContain("Strong");
    expect(chips).not.toContain("Every secret");
  });

  it("draws no line under a card with no prose", () => {
    expect(card("r1")).not.toContain("data-graview-excerpt");
  });
});
