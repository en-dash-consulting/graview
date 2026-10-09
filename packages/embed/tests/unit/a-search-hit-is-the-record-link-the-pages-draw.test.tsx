// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { createSchema, defineApp, defineNode, search, Store, z, type Hit, type Principal } from "@graview/core";
import { act } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { mount, type PagesEmbedHandle, type PagesEmbedOptions } from "../../src/pages.js";

/**
 * A SEARCH HIT IS THE RECORD LINK THE PAGES DRAW (FR-129).
 *
 * Graview Cloud opens each hit of its cross-app search at the record's
 * address on the app's routed face, under the app's base path, and built
 * that address itself. The hit now says it; this holds it to the face's own
 * links: the routed face is drawn by address under a base, each kind's list
 * is opened, and every record link it draws is the address a search for
 * that record gives — a renamed plural, a kind with none, ids that need
 * encoding — and nothing is a hit, or an address, that the seat may not see.
 */
const person = defineNode("person", { fields: z.object({ label: z.string() }), plural: "People" });
const shelfItem = defineNode("shelfItem", { fields: z.object({ label: z.string() }) });
const task = defineNode("task", {
  fields: z.object({ label: z.string() }),
  plural: "Jobs to do",
  edges: { for: { to: ["person"], cardinality: "one", description: "whose it is", inverse: "their jobs" } },
});
const schema = createSchema([person, task, shelfItem]);
const seed = {
  nodes: [
    { id: "person:ada", kind: "person", label: "Ada Lovelace" },
    { id: "person:grace", kind: "person", label: "Grace Hopper" },
    { id: "task:a b/c?d#e", kind: "task", label: "Post the letter" },
    { id: "task:café", kind: "task", label: "Buy stamps" },
    { id: "box 1", kind: "shelfItem", label: "Stamp tin" },
    { id: "ünïcode/✓", kind: "shelfItem", label: "Envelopes" },
  ],
  edges: [
    { kind: "for", from: "task:a b/c?d#e", to: "person:ada" },
    { kind: "for", from: "task:café", to: "person:grace" },
  ],
};
const app = defineApp({ name: "Errands", schema, mutations: [] });
const BASE = "/apps/a1";

const mounted: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const done of mounted.splice(0)) await done();
  window.history.replaceState(null, "", "/");
});
const settle = () => act(async () => new Promise((resolve) => setTimeout(resolve, 20)));

async function pagesAt(path: string, options: Partial<PagesEmbedOptions> = {}) {
  window.history.replaceState(null, "", path);
  const host = document.createElement("div");
  document.body.appendChild(host);
  let handle: PagesEmbedHandle | undefined;
  await act(async () => {
    handle = mount(host, { app, seed, fonts: false, routing: "address", basePath: BASE, ...options } as PagesEmbedOptions);
  });
  await settle();
  mounted.push(async () => {
    await act(async () => handle!.unmount());
    host.remove();
  });
  return host;
}

/** Every record link a list page draws: the links into the list's own address, one segment further. */
const recordLinks = (host: HTMLElement, list: string) =>
  [...host.querySelectorAll("a[href]")].map((a) => a.getAttribute("href")!).filter((href) => href.startsWith(`${list}/`) && !href.slice(list.length + 1).includes("/") && !href.includes("?"));

const nodeHits = (hits: readonly Hit[]) => hits.filter((hit): hit is Extract<Hit, { about: "node" }> => hit.about === "node");

describe("a search hit's address is the routed face's own record link", () => {
  it("for every record of every kind, under the base: a renamed plural, a kind with none, ids that need encoding", async () => {
    const store = new Store({ schema, mutations: [], snapshot: seed as never });
    let compared = 0;
    for (const kind of ["person", "task", "shelfItem"]) {
      const records = seed.nodes.filter((node) => node.kind === kind);
      // The kind's list, at the address a search for the kind gives.
      const plural = schema.tryDefinition(kind)?.plural ?? `${kind}s`;
      const listHit = search(store, plural, { basePath: BASE }).hits.find((hit) => hit.about === "kind" && hit.kind === kind) as Extract<Hit, { about: "kind" }>;
      expect(listHit, kind).toBeDefined();
      const host = await pagesAt(listHit.address);
      // Titled as a label: the plural with its first letter upper-cased ("ShelfItems" for a kind with none declared).
      expect(host.querySelector("[data-graview-page-title]")?.textContent?.trim(), kind).toBe(plural.charAt(0).toUpperCase() + plural.slice(1));
      const links = recordLinks(host, listHit.address).sort();
      const addresses = records.map((node) => nodeHits(search(store, node.label, { basePath: BASE }).hits).find((hit) => hit.id === node.id)!.address).sort();
      expect(links, kind).toEqual(addresses);
      compared += links.length;
    }
    expect(compared).toBe(seed.nodes.length);
  });

  it("opens the record it names: each hit's address, loaded, is that record's page", async () => {
    const store = new Store({ schema, mutations: [], snapshot: seed as never });
    for (const node of seed.nodes) {
      const hit = nodeHits(search(store, node.label, { basePath: BASE }).hits).find((one) => one.id === node.id)!;
      const host = await pagesAt(hit.address);
      expect(host.querySelector("[data-graview-page-title]")?.textContent?.trim(), node.id).toBe(node.label);
    }
  });

  it("names no record, and no address, a seat may not see", () => {
    const store = new Store({
      schema,
      mutations: [],
      snapshot: seed as never,
      policy: { grants: [], sees: [{ roles: ["member"], kinds: ["person", "task"], own: true }] },
    });
    const ada: Principal = { kind: "human", id: "person:ada", roles: ["member"] };
    const seen = nodeHits(search(store, "post buy stamp grace ada envelopes", { principal: ada, basePath: BASE }).hits);
    expect(seen).toEqual([]);
    const own = ["Post the letter", "Buy stamps", "Stamp tin", "Grace Hopper", "Ada Lovelace", "Envelopes"].flatMap((words) => nodeHits(search(store, words, { principal: ada, basePath: BASE }).hits));
    expect(own.map((hit) => hit.address).sort()).toEqual([`${BASE}/jobs-to-do/${encodeURIComponent("task:a b/c?d#e")}`, `${BASE}/people/person%3Aada`]);
  });
});
