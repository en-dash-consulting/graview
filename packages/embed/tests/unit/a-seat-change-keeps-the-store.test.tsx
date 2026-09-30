// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { createSchema, defineApp, defineNode, z, type Principal, type Store } from "@graview/core";
import { createPageRegistry, PageMain, type PageComponent } from "@graview/pages";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { Embed } from "../../src/index.js";

/**
 * CHANGING SEATS KEEPS THE STORE. `<Embed>` handed no store made one from
 * the declaration and the seed — and remade it whenever the principal
 * changed, because the principal was in the memo's dependencies (and handed
 * to a Store that has no such option). A React host that sits a second
 * seat down lost every edit and the whole history.
 */
const car = defineNode("car", { fields: z.object({ label: z.string() }), plural: "Cars" });
const schema = createSchema([car]);
const app = defineApp({ name: "Lot", schema, mutations: [] });
const seen: Store<typeof schema>[] = [];
const Home: PageComponent<typeof schema> = ({ context }) => {
  seen.push(context.store);
  return <PageMain context={context}>home</PageMain>;
};
const pages = createPageRegistry<typeof schema, PageComponent<typeof schema>>(schema).surface("home", Home);
const dana: Principal = { kind: "human", id: "dana", roles: ["manager"] };
const priya: Principal = { kind: "human", id: "priya", roles: ["sales"] };

describe("an embed without a store of its own", () => {
  it("keeps the one it made when another seat sits down", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    const seed = { nodes: [{ id: "c1", kind: "car", label: "Civic" }], edges: [] };
    await act(async () => root.render(<Embed app={app} seed={seed} face="pages" principal={dana} pages={pages} fonts={false} />));
    await act(async () => root.render(<Embed app={app} seed={seed} face="pages" principal={priya} pages={pages} fonts={false} />));
    expect(seen.length).toBeGreaterThanOrEqual(2);
    expect(new Set(seen).size, "one store across the seats").toBe(1);
    await act(async () => root.unmount());
    host.remove();
  });
});
