// @vitest-environment jsdom
/* React's act() wants to know it is in a test environment. */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { createSchema, defineApp, defineNode, Store } from "@graview/core";
import { createViews } from "@graview/react";
import { registerDeclaredLenses, registerDefaultViews } from "@graview/primitives";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { PagesApp, type PageContext } from "../../src/index.js";

/**
 * THE HOME COUNTS IN THE PAGE'S LOCALE, AND ITS PICTURES LINK NOWHERE
 * THEMSELVES (the ninth walk, W-198 and W-200). A beekeeping co-op's home
 * said "7540 inspections" — counted by hand beside `counted` — and its
 * gallery card for a status board, itself a link, drew each of the board's
 * cards as a link inside it: React said "<a> cannot contain a nested <a>"
 * on every visit, and a browser's parser takes such markup apart.
 */
const hive = defineNode("hive", {
  fields: z.object({ label: z.string(), status: z.enum(["strong", "weak"]) }),
  plural: "Hives",
  noun: "hive",
});
const schema = createSchema([hive]);
const app = defineApp({
  name: "Co-op",
  schema,
  lenses: [
    { name: "columns", title: "How the hives are", bindings: { hive: { column: "status" } } },
    { name: "blocks", title: "A dozen hives", on: "hive", options: { blocks: [{ list: "all('hive')", as: "row", limit: 12 }] } },
  ],
});
const store = (many: number) =>
  new Store({
    schema,
    snapshot: { nodes: Array.from({ length: many }, (_, i) => ({ id: `h${i}`, kind: "hive", label: `Meadow ${i}`, status: i % 2 ? "strong" : "weak" })) as never, edges: [] },
  });
const contextOf = (many: number): PageContext<typeof schema> => ({
  store: store(many),
  views: registerDeclaredLenses(registerDefaultViews(schema, createViews(schema)), app as never),
  app: app as never,
});

(Element.prototype as { scrollTo?: unknown }).scrollTo = () => {};

describe("the home", () => {
  it("counts in the page's locale", () => {
    expect(renderToStaticMarkup(<PagesApp context={contextOf(1201)} initialPath="/" />)).toContain('data-testid="standing">1,201 hives.</h2>');
  });

  it("says how many a list cut short leaves, in the page's locale", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => root.render(<PagesApp context={contextOf(1201)} initialPath="/places/a-dozen-hives" />));
    const seeAll = () => host.querySelector('[data-testid="see-all"]');
    for (let tick = 0; tick < 100 && !seeAll(); tick += 1) await act(async () => new Promise((resolve) => setTimeout(resolve, 10)));
    expect(seeAll()?.textContent).toBe("See all 1,201 hives");
    await act(async () => root.unmount());
  });

  it("draws a picture in a card that is a link without a link inside it", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => root.render(<PagesApp context={contextOf(6)} initialPath="/" />));
    const picture = () => host.querySelector('[data-testid="place-card"] [data-testid="place-picture"]');
    for (let tick = 0; tick < 100 && !picture()?.textContent?.includes("Meadow 1"); tick += 1) {
      await act(async () => new Promise((resolve) => setTimeout(resolve, 10)));
    }
    expect(picture()?.textContent).toContain("Meadow 1");
    expect(host.querySelectorAll('[data-testid="place-card"] a')).toHaveLength(0);
    await act(async () => root.unmount());
  });
});
