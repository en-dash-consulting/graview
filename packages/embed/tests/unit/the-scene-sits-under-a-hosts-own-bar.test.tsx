// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { createSchema, defineApp, defineNode, z } from "@graview/core";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeAll, describe, expect, it } from "vitest";
import { Embed, preload, type EmbedBar } from "../../src/index.js";
import { PagesEmbed } from "../../src/pages.js";

beforeAll(() => preload());

/**
 * THE SCENE UNDER A HOST'S OWN BAR. A product with its own shell wants the
 * scene in it; `bar: true` drew the app's name a second time under the
 * host's, and a Scene | Pages switch whose Pages were Graview's derived
 * pages, not the host's — the product hid both with CSS. `bar: { faces:
 * false, name: false }` draws the bar without either: the scene's places,
 * Find, the standing and the person stay.
 */
const plot = defineNode("plot", { fields: z.object({ label: z.string() }), plural: "Plots" });
const schema = createSchema([plot]);
const app = defineApp({ name: "Seedbed", schema, mutations: [] });
const seed = { nodes: [{ id: "p1", kind: "plot", label: "North bed" }], edges: [] };

async function drawn(element: (host: HTMLElement) => React.ReactElement) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => root.render(element(host)));
  await act(async () => new Promise((resolve) => setTimeout(resolve, 20)));
  const has = (id: string) => host.querySelector(`[data-testid="${id}"]`) !== null;
  const said = {
    bar: has("app-bar"),
    switch: has("app-faces"),
    name: has("app-name") || has("app-home"),
    find: has("app-find-open"),
    person: has("profile-button"),
    places: host.querySelector('[data-testid^="app-place"]') !== null,
    named: host.querySelector('[data-testid="app-bar"]')?.textContent?.includes("Seedbed") ?? false,
  };
  await act(async () => root.unmount());
  host.remove();
  return said;
}

const embed = (face: "scene" | "graview" | "pages", bar: boolean | EmbedBar) => () => <Embed app={app} seed={seed} face={face} fonts={false} bar={bar} />;

describe("a host's own bar over the scene", () => {
  it("draws the bar without the switch or the app's name when the host says so, its places, Find and the person kept", async () => {
    const said = await drawn(embed("graview", { faces: false, name: false }));
    expect(said).toMatchObject({ bar: true, switch: false, name: false, find: true, person: true, places: true, named: false });
  });

  it("leaves out the switch alone, or the name alone", async () => {
    expect(await drawn(embed("scene", { faces: false }))).toMatchObject({ switch: false, name: true, find: true });
    expect(await drawn(embed("pages", { name: false }))).toMatchObject({ switch: true, name: false, find: true });
  });

  it("draws the whole bar as before when `bar` is true", async () => {
    expect(await drawn(embed("graview", true))).toMatchObject({ bar: true, switch: true, name: true, find: true });
  });

  it("is the same on the pages alone: the name left out, Find kept", async () => {
    const said = await drawn(() => <PagesEmbed app={app} seed={seed} fonts={false} bar={{ name: false }} />);
    expect(said).toMatchObject({ bar: true, switch: false, name: false, find: true });
  });
});
