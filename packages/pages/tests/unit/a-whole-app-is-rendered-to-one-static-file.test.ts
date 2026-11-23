import { readFileSync } from "node:fs";
import { createSchema, defineApp, defineNode, Store, z, type Policy, type Principal } from "@graview/core";
import { placesOf } from "@graview/core/seat";
import { pageAnchor, renderSite } from "@graview/pages/static";
import { describe, expect, it } from "vitest";
import { createTodoStore, todoApp } from "../../../../apps/todo/src/domain/app.js";

/**
 * A WHOLE APP IS RENDERED TO ONE STATIC FILE (HQ f-static-render-pictures-site-pdf).
 * A host that exported an app as one HTML file rendered each place with
 * `renderPlace` and rewrote every link between them into the file itself.
 * `renderSite` writes the file: every place and every record's page the
 * seat may see, one document, each page an article with its own id, every
 * link one within the file — and one to a page it does not hold, no link.
 * In print each page begins a sheet of its own, which is the whole of what
 * a PDF of it asks of the page (the host prints it; nothing here runs a
 * browser).
 */

const example = JSON.parse(readFileSync(new URL("../../../../apps/todo/src/data/example.json", import.meta.url), "utf8"));
const keeper: Principal = { kind: "human", id: "user-nora", roles: ["keeper"] };
const TODAY = "2026-09-01";
const todo = () => createTodoStore({ snapshot: example });

const hrefs = (html: string) => [...html.matchAll(/<a [^>]*href="([^"]*)"/g)].map(([, href]) => href!);
const ids = (html: string) => new Set([...html.matchAll(/ id="([^"]*)"/g)].map(([, id]) => id!));

describe("the todo example as one file", () => {
  it("holds every place and every record's page, once each, in one static document", () => {
    const store = todo();
    const site = renderSite(store, todoApp, { viewer: keeper, today: TODAY });
    expect(site.html.match(/<!doctype html>/g)).toHaveLength(1);
    expect(site.html.match(/<style>/g)).toHaveLength(1);
    expect(site.html).not.toMatch(/<script|\son[a-z]+\s*=|<form|<button|<input|javascript:/i);
    const addresses = site.pages.map((page) => page.address);
    expect(new Set(addresses).size).toBe(addresses.length);
    for (const place of placesOf(todoApp)) expect(addresses).toContain(place.address);
    for (const task of store.graph.nodesOfKind("task")) expect(addresses).toContain(`/tasks/${encodeURIComponent(task.id)}`);
    for (const page of site.pages) expect(site.html).toContain(`<article class="gv-site-page" id="${page.anchor}">`);
    expect(site.title).toBe(todoApp.brand?.name ?? todoApp.name);
  });

  it("links only within the file: every link goes to a page it holds", () => {
    const site = renderSite(todo(), todoApp, { viewer: keeper, today: TODAY, base: "/a/todo" });
    const links = hrefs(site.html);
    expect(links.length).toBeGreaterThan(20);
    const held = ids(site.html);
    for (const href of links) {
      expect(href.startsWith("#"), href).toBe(true);
      expect(held.has(href.slice(1)), href).toBe(true);
    }
    // The contents names each place, and the masthead goes home.
    expect(site.html).toContain('<nav class="gv-contents" aria-label="Pages">');
    expect(site.html).toContain(`<header class="gv-masthead"><a href="#${pageAnchor("/")}">`);
  });

  it("begins each page on a sheet of its own in print", () => {
    const site = renderSite(todo(), todoApp, { viewer: keeper, today: TODAY });
    expect(site.css).toMatch(/@media print \{[\s\S]*\.gv-site-page \{ break-before: page;/);
    expect(site.css).toContain("@page {");
  });

  it("writes a kind's records with a design's writer, whose links are the file's own", () => {
    const store = todo();
    const list = store.graph.nodesOfKind("list")[0]!;
    const site = renderSite(store, todoApp, {
      viewer: keeper,
      today: TODAY,
      design: { records: { list: (record, at) => `<h1 class="mine">${record.title}</h1><a href="${at.href("/tasks")}">All tasks</a>` } },
    });
    expect(site.html).toContain(`<article class="gv-site-page" id="${pageAnchor(`/lists/${encodeURIComponent(list.id)}`)}">\n<h1 class="mine">`);
    expect(site.html).toContain(`<a href="#${pageAnchor("/tasks")}">All tasks</a>`);
  });
});

const car = defineNode("car", {
  fields: z.object({ label: z.string(), status: z.string() }),
  plural: "Cars",
});
const shopper = defineNode("shopper", {
  fields: z.object({ label: z.string() }),
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
const showroom = defineApp({ name: "showroom", schema, policy });
const showroomStore = () =>
  new Store({
    schema,
    policy,
    snapshot: {
      nodes: [
        { id: "car:golf", kind: "car", label: "2021 Golf", status: "listed" },
        { id: "shopper:bethan", kind: "shopper", label: "Bethan Okonkwo" },
      ] as never,
      edges: [{ kind: "shortlisted", from: "shopper:bethan", to: "car:golf" }],
    },
  });

describe("an app with a sight", () => {
  it("holds nothing a stranger may not see — no page, no link, no name", () => {
    const stranger: Principal = { kind: "human", id: "browsing", roles: [] };
    const site = renderSite(showroomStore(), showroom, { viewer: stranger });
    expect(site.pages.map((page) => page.address)).toContain("/cars/car%3Agolf");
    expect(site.pages.map((page) => page.address).some((address) => address.startsWith("/shoppers"))).toBe(false);
    expect(site.html).not.toContain("Bethan");
    const held = ids(site.html);
    for (const href of hrefs(site.html)) expect(held.has(href.slice(1)), href).toBe(true);
  });

  it("holds the shoppers for the staff, linked both ways", () => {
    const staff: Principal = { kind: "human", id: "staff:rhian", roles: ["staff"] };
    const site = renderSite(showroomStore(), showroom, { viewer: staff });
    expect(site.html).toContain(`<a href="#${pageAnchor("/shoppers/shopper%3Abethan")}">Bethan Okonkwo</a>`);
    expect(site.html).toContain(`<a href="#${pageAnchor("/cars/car%3Agolf")}">2021 Golf</a>`);
  });
});
