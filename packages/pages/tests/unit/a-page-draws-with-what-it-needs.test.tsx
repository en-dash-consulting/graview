import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { createSchema, defineNode, Store } from "@graview/core";
import { createViews, type ViewComponent } from "@graview/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { PagesApp, placePath, type PageContext } from "../../src/index.js";

/**
 * A PAGE DRAWS WITH WHATEVER THE PICTURE NEEDS — HTML AND CANVAS BOTH.
 *
 * The routed face was traditional on purpose: lists, records, links, forms,
 * the paradigms people already know. That was the right shape for a site
 * derived from a schema, and the wrong ceiling once every registered place
 * became a page — a lens that draws best on a canvas has no business being
 * capped at what it can express in the DOM just because a phone and a search
 * engine are the ones looking.
 *
 * The one exception is HTML-in-Canvas — `layoutsubtree` and
 * `drawElementImageToTexture`, the capture path the spatial scene's GPU
 * renderer uses. It is Chromium-only by nature, mid-origin-trial, and behind
 * a flag; it is why every app's `chooseRenderer` defaults to DOM. On this
 * face it is not defaulted off, it is absent, and that is asserted rather
 * than assumed.
 */
const reading = defineNode("reading", {
  fields: z.object({ label: z.string(), at: z.number() }),
  plural: "Readings",
  description: "A number taken off a meter.",
});
const schema = createSchema([reading]);
const store = () =>
  new Store({
    schema,
    mutations: [],
    snapshot: {
      nodes: [
        { id: "r1", kind: "reading", label: "Monday", at: 3 },
        { id: "r2", kind: "reading", label: "Tuesday", at: 9 },
      ] as never,
      edges: [],
    },
  });

/*
 * A LENS THAT DRAWS RATHER THAN LAYS OUT. A sparkline over its members is
 * the honest small case: nothing about it is expressible as boxes, it wants
 * a drawing surface, and it still owes the page a heading and a way in for
 * anyone who cannot see it.
 */
const Trace: ViewComponent<typeof schema> = ({ nodes, label }) => (
  <figure data-testid="trace" style={{ margin: 0 }}>
    <figcaption>{label}</figcaption>
    <canvas data-testid="trace-canvas" width={480} height={120} role="img" aria-label={`${label}: ${nodes?.length ?? 0} readings`} />
    {/* What a reader gets when the canvas cannot start, and what a search
        engine reads either way: the picture's own numbers, in the document. */}
    <ul data-testid="trace-fallback">
      {(nodes ?? []).map((node) => (
        <li key={node.id}>
          {(node as { label: string }).label}: {(node as { at: number }).at}
        </li>
      ))}
    </ul>
  </figure>
);

const views = () => createViews(schema).register("reading", { cardinality: "many", fidelity: "full" }, Trace, { title: "The trace" });

const context = (): PageContext<typeof schema> => ({ store: store(), views: views(), sceneHref: "/" });

const at = (path: string) => renderToStaticMarkup(<PagesApp initialPath={path} context={context()} />);

describe("a page draws with what the picture needs", () => {
  it("puts a lens that wants a canvas on its own page, canvas and all", () => {
    const page = at(placePath("the-trace"));
    expect(page).toContain('data-testid="trace-canvas"');
    expect(page).toContain("<canvas");
  });

  it("leads the home with it, the same as any other picture", () => {
    expect(at("/")).toContain('data-testid="trace-canvas"');
  });

  it("keeps what a reader needs beside the drawing", () => {
    // A canvas says nothing to a screen reader, to a search engine, or to a
    // browser that could not start it. The page is where that has to hold.
    const page = at(placePath("the-trace"));
    expect(page).toContain('role="img"');
    expect(page).toContain("2 readings");
    expect(page).toContain('data-testid="trace-fallback"');
    expect(page).toContain("Tuesday");
  });

  it("never reaches for HTML-in-Canvas, whatever a view asks for", () => {
    /*
     * `layoutsubtree` is what turns a canvas into a capture surface, and the
     * attribute is the whole of the opt-in. A page must not carry it on any
     * route, including the one drawing a canvas lens.
     */
    for (const path of ["/", "/problems", "/map", "/places", placePath("the-trace"), "/readings", "/readings/r1"]) {
      expect(at(path)).not.toContain("layoutsubtree");
    }
  });

  it("cannot reach the capture seam at all, by construction", () => {
    /*
     * The strongest form of the promise, and the cheapest to keep: every
     * call into the HTML-in-Canvas API passes through
     * `@graview/render`'s platform seam and nowhere else, and this package
     * does not depend on `@graview/render`. A future import would have to
     * add the dependency, and this says so before it renders anything.
     */
    const here = resolve(import.meta.dirname, "../..");
    const manifest = JSON.parse(readFileSync(resolve(here, "package.json"), "utf8")) as {
      dependencies?: Record<string, string>;
    };
    expect(Object.keys(manifest.dependencies ?? {})).not.toContain("@graview/render");

    const sources: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        const path = resolve(dir, entry);
        if (statSync(path).isDirectory()) walk(path);
        else if (/\.tsx?$/.test(entry)) sources.push(readFileSync(path, "utf8"));
      }
    };
    walk(resolve(here, "src"));
    for (const source of sources) {
      expect(source).not.toContain("@graview/render");
      expect(source).not.toContain("layoutsubtree");
      expect(source).not.toContain("ElementImageToTexture");
    }
  });
});
