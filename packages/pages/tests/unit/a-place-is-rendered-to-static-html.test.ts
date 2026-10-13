import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createContext, runInContext } from "node:vm";
import { createSchema, defineApp, defineNode, SCHEMES, Store, z, type Policy, type Principal } from "@graview/core";
import { placesOf } from "@graview/core/seat";
import { describe, expect, it } from "vitest";
import { createTodoStore, todoApp } from "../../../../apps/todo/src/domain/app.js";

/**
 * A PLACE IS RENDERED TO STATIC HTML, OFF THE BROWSER (FR-174). A host that
 * keeps a fixed link — a schedule as a PDF, a roster — renders it again on
 * each change in a Worker with no DOM: `renderPlace` from
 * `@graview/pages/static` says a list, a record, a declared place and the
 * home as one self-contained document in the app's look, with no script,
 * under the viewer's sight.
 */

// The entry is imported with no DOM about: nothing of a browser is read as it loads, or as it renders.
expect(typeof (globalThis as { window?: unknown }).window).toBe("undefined");
expect(typeof (globalThis as { document?: unknown }).document).toBe("undefined");
const { renderPlace, staticCss } = await import("@graview/pages/static");

const example = JSON.parse(readFileSync(new URL("../../../../apps/todo/src/data/example.json", import.meta.url), "utf8"));
const keeper: Principal = { kind: "human", id: "user-nora", roles: ["keeper"] };
const member: Principal = { kind: "human", id: "user-sam", roles: ["member"] };
const TODAY = "2026-09-01";
const todo = () => createTodoStore({ snapshot: example });

/** A page is static: no script, no handler, no form, no control. */
function expectStatic(html: string) {
  expect(html.startsWith("<!doctype html>")).toBe(true);
  expect(html).not.toMatch(/<script|\son[a-z]+\s*=|<form|<button|<input|<select|<textarea|javascript:/i);
  // Self-contained: the look is inlined, nothing is fetched to draw it.
  expect(html).toMatch(/<style>[\s\S]*--graview-ink:[\s\S]*<\/style>/);
  expect(html).not.toMatch(/<link\s/i);
}

describe("each page kind of the todo example, in Node", () => {
  it("renders the home: the app's name, how many of each, in its look", () => {
    const page = renderPlace(todo(), todoApp, "home", { viewer: keeper, today: TODAY });
    expectStatic(page.html);
    expect(page.found).toBe(true);
    expect(page.html).toContain("<h1>");
    expect(page.html).toMatch(/12 tasks/);
    expect(page.title).toContain(todoApp.brand?.name ?? todoApp.name);
    // The brand's own tokens, not the framework's defaults.
    expect(page.css).toContain(`--graview-accent: ${todoApp.brand!.schemes.light.accent}`);
    expect(page.html).toContain(page.css);
  });

  it("renders a list: its plural, its declared description, its count and each record with its glance", () => {
    const store = todo();
    const page = renderPlace(store, todoApp, "/tasks", { viewer: keeper, today: TODAY });
    expectStatic(page.html);
    expect(page.title).toMatch(/^Tasks — /);
    expect(page.html).toContain("One thing to do.");
    for (const task of store.graph.nodesOfKind("task").slice(0, 3)) expect(page.html).toContain(`href="/tasks/${encodeURIComponent(task.id)}"`);
    expect(page.html).toMatch(/class="gv-glance"/);
  });

  it("renders a record: its kind, its name, its facts, and its relations in the declaration's words", () => {
    const store = todo();
    const list = store.graph.nodesOfKind("list")[0]!;
    const page = renderPlace(store, todoApp, `/lists/${encodeURIComponent(list.id)}`, { viewer: keeper, today: TODAY });
    expectStatic(page.html);
    expect(page.found).toBe(true);
    expect(page.html).toContain(`<h1>${(list as { label: string }).label}</h1>`);
    expect(page.html).toContain('href="/lists"');
    expect(page.html).toContain("The tasks on this list");
    // The same record by its id.
    expect(renderPlace(store, todoApp, list.id, { viewer: keeper }).html).toBe(page.html);
  });

  it("renders every declared place the declaration has", () => {
    const store = todo();
    for (const place of placesOf(todoApp).filter((one) => one.lens)) {
      const page = renderPlace(store, todoApp, place, { viewer: keeper, today: TODAY });
      expectStatic(page.html);
      expect(page.found, place.slug).toBe(true);
      expect(page.html).toContain(`<h1>${place.title}</h1>`);
    }
  });

  it("puts links under the host's address when given one", () => {
    const page = renderPlace(todo(), todoApp, "/tasks", { viewer: keeper, base: "https://example.test/app/" });
    expect(page.html).toMatch(/href="https:\/\/example\.test\/app\/tasks\//);
  });

  it("never renders the people to a member, whose sight does not reach them, and says so as for nothing at all", () => {
    const store = todo();
    const nora = renderPlace(store, todoApp, "/people/user-nora", { viewer: keeper });
    expect(nora.found).toBe(true);
    const hidden = renderPlace(store, todoApp, "/people/user-nora", { viewer: member });
    const nothing = renderPlace(store, todoApp, "/people/user-nobody", { viewer: member });
    expect(hidden.found).toBe(false);
    expect(hidden.html).toBe(nothing.html);
    expect(hidden.html).not.toContain("Nora");
    // Nor counted on the home, nor drawn as the picture of them, nor named under a record.
    expect(renderPlace(store, todoApp, "home", { viewer: keeper }).html).toMatch(/2 people/);
    expect(renderPlace(store, todoApp, "home", { viewer: member }).html).not.toMatch(/people|invitation/i);
    expect(renderPlace(store, todoApp, "Who may do what", { viewer: member }).found).toBe(false);
    // A kind's address that names another kind's record is no record's.
    const task = store.graph.nodesOfKind("task")[0]!;
    expect(renderPlace(store, todoApp, `/lists/${task.id}`, { viewer: keeper }).found).toBe(false);
  });
});

/* A showroom with a sight, a describe line, a card and a status board. */
const car = defineNode("car", {
  description: "A car on the lot.",
  fields: z.object({ label: z.string(), price: z.number(), status: z.enum(["listed", "reserved", "sold"]) }),
  plural: "Cars",
  describe: (node) => `${node.label}, ${node.status}, at ${node.price}`,
});
const shopper = defineNode("shopper", {
  fields: z.object({ label: z.string(), email: z.string() }),
  plural: "Shoppers",
  edges: { shortlisted: { to: ["car"], description: "the cars on their shortlist", inverse: "the shoppers who shortlisted it" } },
});
const schema = createSchema([car, shopper]);
const policy: Policy = {
  grants: [{ roles: ["staff"], mutations: "*" }],
  sees: [
    { roles: "*", kinds: ["car"] },
    { roles: ["staff"], kinds: ["shopper"] },
  ],
};
const showroom = defineApp({
  name: "showroom",
  schema,
  policy,
  viewSpecs: { car: { card: [{ title: "{label}" }, { badge: "{status}" }] } },
  lenses: [{ name: "columns", title: "The board", bindings: { car: { column: "status" } } }],
});
const showroomStore = () =>
  new Store({
    schema,
    policy,
    snapshot: {
      nodes: [
        { id: "car:golf", kind: "car", label: "2021 Golf", price: 14000, status: "listed" },
        { id: "car:polo", kind: "car", label: "2019 Polo", price: 9000, status: "reserved" },
        { id: "shopper:bethan", kind: "shopper", label: "Bethan Okonkwo", email: "bethan@mail.example" },
      ] as never,
      edges: [{ kind: "shortlisted", from: "shopper:bethan", to: "car:golf" }],
    },
  });
const stranger: Principal = { kind: "human", id: "browsing", roles: [] };
const staff: Principal = { kind: "human", id: "staff:rhian", roles: ["staff"] };

describe("an app with a sight, a describe line and a board", () => {
  it("says a record's describe line under its name, as the page does", () => {
    const page = renderPlace(showroomStore(), showroom, "/cars/car%3Agolf", { viewer: stranger });
    expect(page.found).toBe(true);
    expect(page.html).toContain('<p class="gv-lede">2021 Golf, listed, at 14000</p>');
  });

  it("shows a stranger no shopper, on the home, a list, a car or the board", () => {
    const store = showroomStore();
    for (const place of ["home", "/cars", "/cars/car%3Agolf", "The board", "/shoppers"]) {
      const html = renderPlace(store, showroom, place, { viewer: stranger }).html;
      expect(html, place).not.toMatch(/Bethan|mail\.example/);
    }
    expect(renderPlace(store, showroom, "/shoppers/shopper%3Abethan", { viewer: stranger }).found).toBe(false);
    // Staff see who shortlisted the car.
    expect(renderPlace(store, showroom, "/cars/car%3Agolf", { viewer: staff }).html).toContain("Bethan Okonkwo");
  });

  it("draws the board's columns as sections, each card as on the page, a page apart in print", () => {
    const page = renderPlace(showroomStore(), showroom, "The board", { viewer: stranger });
    expectStatic(page.html);
    expect(page.html).toMatch(/<section class="gv-section"><h2>Listed \(1\)<\/h2>/);
    expect(page.html).toMatch(/<section class="gv-section"><h2>Reserved \(1\)<\/h2>/);
    expect(page.html).toMatch(/<article class="gv-card">[\s\S]*2021 Golf[\s\S]*<span class="gv-badge">listed<\/span>/i);
    expect(page.css).toMatch(/@media print \{[\s\S]*\.gv-section \+ \.gv-section \{ break-before: page;/);
  });

  it("wears the scheme it is asked for, and the brand it is handed", () => {
    const dark = renderPlace(showroomStore(), showroom, "home", { look: { scheme: "dark" } });
    expect(dark.css).toContain("color-scheme: dark");
    // An app with no brand of its own wears the framework's palettes, by the same sheet a host can ask for alone.
    expect(dark.css).toBe(staticCss({ name: "showroom", schemes: SCHEMES }, "dark"));
  });
});

describe("the entry", () => {
  it("bundles with nothing left to import, and renders in a bare context with no window, document, process or require — as a Worker would run it", async () => {
    const { build } = await import("esbuild");
    // @ts-expect-error — a plain .mjs module, without types.
    const { graviewSources } = await import("../../../../scripts/lib/graview-sources.mjs");
    const repo = fileURLToPath(new URL("../../../../", import.meta.url));
    const entry = `
      import { createSchema, defineApp, defineNode, Store, z } from "@graview/core";
      import { renderPlace } from "@graview/pages/static";
      const item = defineNode("item", { fields: z.object({ label: z.string() }), plural: "Items", describe: (node) => "An item called " + node.label });
      const schema = createSchema([item]);
      const app = defineApp({ name: "shelf", schema });
      const store = new Store({ schema, snapshot: { nodes: [{ id: "a", kind: "item", label: "Lamp" }], edges: [] } });
      globalThis.rendered = [renderPlace(store, app, "home"), renderPlace(store, app, "/items"), renderPlace(store, app, "/items/a")];
    `;
    const bundled = await build({
      stdin: { contents: entry, resolveDir: repo, loader: "ts" },
      bundle: true,
      write: false,
      format: "iife",
      platform: "neutral",
      mainFields: ["module", "main"],
      plugins: [graviewSources(repo)],
      metafile: true,
      logLevel: "silent",
    });
    const inputs = Object.keys(bundled.metafile.inputs);
    expect(inputs.filter((path) => /node_modules\/(react|react-dom|react-router|react-router-dom)\//.test(path))).toEqual([]);
    expect(inputs.filter((path) => /packages\/(react|primitives|tools|layout|render)\//.test(path))).toEqual([]);
    const context = createContext({ URL, TextEncoder, TextDecoder, console });
    runInContext(bundled.outputFiles[0]!.text, context);
    const [home, list, record] = (context as { rendered: { html: string; found: boolean }[] }).rendered;
    expect(home!.found && list!.found && record!.found).toBe(true);
    expect(list!.html).toContain('href="/items/a">Lamp</a>');
    expect(record!.html).toContain("An item called Lamp");
  }, 60_000);

  it("imports nothing of React, the router, the DOM faces or the seat", () => {
    const source = readFileSync(new URL("../../src/static.ts", import.meta.url), "utf8");
    const imported = [...source.matchAll(/from "([^"]+)"/g)].map((match) => match[1]);
    expect(imported.sort()).toEqual(["@graview/core", "@graview/core/blocks", "@graview/core/describe", "@graview/core/words"]);
  });
});
