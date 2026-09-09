import { createSchema, defineNode, Store } from "@graview/core";
import { EMPTY_VIEW } from "@graview/layout";
import { GraviewProvider, createViews } from "@graview/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { registerDefaultViews, Shell } from "../../src/index.js";

/**
 * The shell is the one file every app used to write and get slightly wrong.
 * What is pinned here is what an app gets without writing it: the parts, in
 * order, the landmarks assistive technology expects, and the test ids the
 * harnesses drive.
 */
const note = defineNode("note", {
  fields: z.object({ label: z.string() }),
  plural: "Notes",
});
const schema = createSchema([note]);
const store = () => new Store({ schema, mutations: [], invariants: [] });

const render = (props: Partial<Parameters<typeof Shell<typeof schema>>[0]> = {}) =>
  renderToStaticMarkup(
    <GraviewProvider
      store={store()}
      views={registerDefaultViews(schema, createViews(schema))}
      initialView={{ ...EMPTY_VIEW, overview: true }}
      brand={{ name: "Field Notes" } as never}
    >
      <Shell<typeof schema> scheme="light" onScheme={() => {}} {...props} />
    </GraviewProvider>,
  );

describe("the shell", () => {
  it("has the landmarks a page needs: one heading, one main, the bar as banner", () => {
    const html = render();
    expect(html.match(/<h1/g)?.length).toBe(1);
    expect(html).toContain("Field Notes</h1>");
    expect(html.match(/<main/g)?.length).toBe(1);
    expect(html).toContain("<header");
  });

  it("carries the parts the harnesses drive, under the ids they use", () => {
    const html = render({ seat: () => <button type="button" data-testid="agent-x">seat</button> });
    for (const id of ["pages-link", "standing", "activity-button", "scheme", "overview"]) {
      expect(html, id).toContain(`data-testid="${id}"`);
    }
    expect(html).toContain('href="/pages"');
    expect(html).toContain('aria-label="Switch to dark mode"');
  });

  it("says what the app says when nothing is wrong, and hides the pages link when asked", () => {
    const html = render({ standing: "The garden keeps its agreements", pagesHref: null, chat: false });
    expect(html).toContain("The garden keeps its agreements");
    expect(html).not.toContain('data-testid="pages-link"');
  });

  it("puts the app's own navigation between the browser controls and the trail", () => {
    const html = render({ nav: <nav data-testid="places">places</nav> });
    const backtrack = html.indexOf('data-testid="backtrack"');
    const places = html.indexOf('data-testid="places"');
    expect(backtrack).toBeGreaterThan(-1);
    expect(places).toBeGreaterThan(backtrack);
  });
});

describe("Focus, from altitude", () => {
  it("descends into the selected district, or the first one declared, never nowhere", async () => {
    const { descentTarget } = await import("../../src/index.js");
    const { aggregateId, kindCardId } = await import("@graview/layout");
    const altitude = { ...EMPTY_VIEW, overview: true };
    expect(descentTarget(altitude, ["note", "tag"])).toBe(aggregateId("note"));
    expect(descentTarget({ ...altitude, selection: [kindCardId("tag")] }, ["note", "tag"])).toBe(aggregateId("tag"));
    expect(descentTarget({ ...altitude, focusId: "note:a" }, ["note"])).toBe("note:a");
    expect(descentTarget(altitude, [])).toBeNull();
  });
});
