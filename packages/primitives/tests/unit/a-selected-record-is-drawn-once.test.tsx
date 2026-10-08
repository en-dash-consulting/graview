import { readFileSync } from "node:fs";
import { Store, type AnySchema } from "@graview/core";
import { compileDocument } from "@graview/core/check";
import { EMPTY_VIEW } from "@graview/layout";
import { PagesApp, recordPath } from "@graview/pages";
import { registerDefaultViews, registerViewSpecs } from "@graview/primitives";
import { createViews, GraviewProvider, type ViewProps } from "@graview/react";
import type { ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

/**
 * FR-141. Graview Cloud's workshop: a part declares its card and its page,
 * each saying its goal and listing the topics it covers. Selected Down in
 * its district, it was drawn twice — the page bare behind, the framework's
 * record in front saying the goal and the topics again, the topics as chips
 * under a "Covers" heading. The record in focus (one × full) is one frame
 * now: the page's title is the frame's, the page's blocks come first, and
 * the record adds only the fields and ties the page did not say.
 */
const fixtures = new URL("../../../../scripts/fixtures/drawn-once/", import.meta.url);
const workshop = JSON.parse(readFileSync(new URL("workshop.gdd.json", fixtures), "utf8"));
const seed = JSON.parse(readFileSync(new URL("workshop.seed.json", fixtures), "utf8"));
const PART = seed.nodes.find((node: { id: string }) => node.id === "segment:ongoing-support");
const TOPICS: string[] = seed.nodes.filter((node: { kind: string }) => node.kind === "topic").map((node: { title: string }) => node.title);

function drawn(views: Record<string, unknown> = workshop.views) {
  const result = compileDocument({ ...workshop, views }, { today: () => "2026-10-08" });
  if (!result.ok) throw new Error("the workshop compiles");
  const schema = result.app.schema as AnySchema;
  const store = new Store<AnySchema>({ schema, mutations: result.app.mutations ?? [], snapshot: seed as never });
  const registry = registerViewSpecs(registerDefaultViews(schema, createViews(schema)), schema, result.app.viewSpecs);
  const View = registry.lookup("segment", { cardinality: "one", fidelity: "full" }) as ComponentType<ViewProps<AnySchema>>;
  return renderToStaticMarkup(
    <GraviewProvider store={store} views={registry} initialView={EMPTY_VIEW}>
      <View node={store.graph.getNode(PART.id) as never} cardinality="one" fidelity="full" mode="scene" selected />
    </GraviewProvider>,
  );
}
const times = (html: string, words: string) => html.split(words).length - 1;

describe("a selected record is drawn once", () => {
  it("draws a declared page inside the record's one frame, its title the frame's", () => {
    const html = drawn();
    expect(times(html, 'data-graview-primitive="panel"')).toBe(1);
    expect(html.indexOf('data-graview-primitive="panel"')).toBeLessThan(html.indexOf('data-graview-spec="page"'));
    expect(times(html, PART.title)).toBe(1);
  });

  it("says the goal and the summary once, and each topic once", () => {
    const html = drawn();
    expect(times(html, PART.goal)).toBe(1);
    expect(times(html, PART.summary.replace(/'/g, "&#x27;"))).toBe(1);
    for (const topic of TOPICS) expect(times(html, `>${topic}<`)).toBe(1);
  });

  it("adds only what the page left unsaid, and no heading over nothing", () => {
    const html = drawn();
    // The page says the goal, the summary and the topics; the record adds the order and the phase.
    expect(html).toContain(">Order<");
    expect(html).toContain(">Phase<");
    expect(html).not.toContain(">Goal<");
    expect(html).not.toMatch(/<h2[^>]*>covers<\/h2>/i);
    expect(html).not.toContain("Nothing is connected");
    // The kind's description is furniture under an author's page.
    expect(html).not.toContain("One part of the workshop, in the order it runs.");
  });

  it("leaves out, on the pages face's record page, what the page at its head already says", () => {
    const result = compileDocument(workshop, { today: () => "2026-10-08" });
    if (!result.ok) throw new Error("the workshop compiles");
    const schema = result.app.schema as AnySchema;
    const store = new Store<AnySchema>({ schema, mutations: result.app.mutations ?? [], snapshot: seed as never });
    const registry = registerViewSpecs(registerDefaultViews(schema, createViews(schema)), schema, result.app.viewSpecs);
    const html = renderToStaticMarkup(<PagesApp context={{ store, views: registry }} initialPath={recordPath(schema, "segment", PART.id)} />);
    expect(html).toContain('data-graview-spec="page"');
    expect(times(html, PART.goal)).toBe(1);
    for (const topic of TOPICS) expect(times(html, `>${topic}<`)).toBe(1);
    // The order and the phase, which the page does not say, are still the facts.
    expect(html).toContain(">Order<");
    expect(html).toContain(">Phase<");
  });

  it("draws the framework's record alone where the kind declares only a card", () => {
    const html = drawn({ ...workshop.views, segment: { card: workshop.views.segment.card } });
    expect(html).not.toContain('data-graview-spec="page"');
    expect(times(html, PART.goal)).toBe(1);
    for (const topic of TOPICS) expect(times(html, `>${topic}<`)).toBe(1);
  });
});
