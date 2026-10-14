// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { appLinkField, createSchema, defineNode, Store, type ResolveApp } from "@graview/core";
import { EMPTY_VIEW } from "@graview/layout";
import { GraviewProvider, createViews } from "@graview/react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { registerDefaultViews, Shell } from "../../src/index.js";

/*
 * THE SHELL TAKES `resolveApp` ITSELF (FR-171). The host's way to name
 * another app was the provider's alone, so a host drawing the Shell had to
 * reach around it and wrap the provider to have an app-link drawn as the
 * app rather than its address. Handed to the Shell, it is asked, and the
 * record shows the app it names.
 */
const scenario = defineNode("scenario", { fields: z.object({ label: z.string(), house: appLinkField().optional() }), plural: "scenarios" });
const schema = createSchema([scenario]);
const seeded = () => new Store({ schema, mutations: [], invariants: [], snapshot: { nodes: [{ id: "outright", kind: "scenario", label: "Buy it outright", house: "@nick/house" }], edges: [] } as never });

const asked: string[] = [];
const resolveApp: ResolveApp = async (address) => {
  asked.push(address);
  return address === "@nick/house" ? { name: "12 Elm Street", icon: "🏠", headline: "3 bed", href: "/a/nick/house" } : null;
};

const roots: { unmount(): void }[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) act(() => root.unmount());
  document.body.innerHTML = "";
  asked.length = 0;
});

async function open(given: ResolveApp | undefined) {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  roots.push(root);
  await act(async () => {
    root.render(
      <GraviewProvider store={seeded()} views={registerDefaultViews(schema, createViews(schema))} initialView={{ ...EMPTY_VIEW, focusId: "outright" }}>
        <Shell<typeof schema> scheme="light" onScheme={() => {}} pagesHref={null} {...(given ? { resolveApp: given } : {})} />
      </GraviewProvider>,
    );
  });
  for (let i = 0; i < 100; i++) {
    const link = host.querySelector("[data-graview-app-link]");
    if (link && link.getAttribute("data-graview-app-state") !== "asking") break;
    await act(async () => void (await new Promise((done) => setTimeout(done, 10))));
  }
  return host;
}

describe("the Shell's resolveApp", () => {
  it("names the app a record links, with no resolver on the provider", async () => {
    const host = await open(resolveApp);
    const link = host.querySelector<HTMLElement>("[data-graview-app-link]");
    expect(link?.getAttribute("data-graview-app-state")).toBe("found");
    expect(link?.getAttribute("href")).toBe("/a/nick/house");
    expect(link?.textContent).toContain("12 Elm Street");
    expect(asked).toEqual(["@nick/house"]);
  });

  it("draws the address as it is kept when nobody hands one", async () => {
    const host = await open(undefined);
    const link = host.querySelector<HTMLElement>("[data-graview-app-link]");
    expect(link?.getAttribute("data-graview-app-state")).not.toBe("found");
    expect(link?.textContent).toContain("@nick/house");
  });
});
