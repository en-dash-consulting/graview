// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import type { AppResolution, Principal, ResolveApp } from "@graview/core";
import { compileDocument } from "@graview/core/check";
import { act } from "react";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { mount, preload, type EmbedHandle } from "../../src/index.js";

beforeAll(() => preload());

/**
 * FR-171. ANOTHER APP ON A RECORD IS NAMED BY THE HOST.
 *
 * A scenario links the house it buys, which lives in another app. The
 * host hands `resolveApp(address, viewer)`: the field draws that app's
 * icon, name and home headline, linked to where it opens — never the
 * address. A viewer the host refuses sees "linked app (no access)" and
 * nothing of the app. Without a resolver, the address, plainly. The host
 * is asked once per address and viewer, however many records link it.
 */
const compiled = compileDocument({
  format: "graview-document",
  formatVersion: 1,
  name: "Purchase scenarios",
  kinds: { scenario: { fields: { name: { type: "string", required: true }, house: { type: "app-link" } } } },
  acts: { "add-scenario": { title: "Add a scenario", creates: "scenario" } },
});
if (!compiled.ok) throw new Error("the scenarios document compiles");
const app = compiled.app;
const seed = {
  nodes: [
    { id: "outright", kind: "scenario", name: "Buy it outright", house: "@nick/house" },
    { id: "mortgage", kind: "scenario", name: "Take a mortgage", house: "@nick/house" },
    { id: "elsewhere", kind: "scenario", name: "Somewhere else", house: "@ana/flat" },
    { id: "plain", kind: "scenario", name: "On the web", house: "https://example.com/listing" },
  ],
  edges: [],
};
const me: Principal = { kind: "human", id: "acct_me", roles: ["member"] };

const asked: string[] = [];
/** A host's resolver, fresh for each test: what it remembers is per resolver. */
const resolver = (): ResolveApp => async (address, viewer) => {
  asked.push(`${viewer.id}:${address}`);
  if (address === "@nick/house") return { name: "12 Elm Street", icon: "🏠", headline: "3 bed · offer accepted", href: "/a/nick/house" } satisfies AppResolution;
  if (address === "@ana/flat") return { denied: true };
  return null;
};

const mounted: { handle: EmbedHandle; host: HTMLElement }[] = [];
afterEach(async () => {
  for (const { handle, host } of mounted.splice(0)) {
    await act(async () => handle.unmount());
    host.remove();
  }
  asked.length = 0;
});
async function open(path: string, withResolver = true) {
  const host = document.createElement("div");
  document.body.append(host);
  let handle!: EmbedHandle;
  await act(async () => {
    handle = mount(host, { app: app as never, seed: seed as never, face: "pages", path, principal: me, fonts: false, studio: false, ...(withResolver ? { resolveApp: resolver() } : {}) });
  });
  mounted.push({ handle, host });
  // The part is fetched with the first link drawn, and the host answers after.
  for (let i = 0; i < 100; i++) {
    if (host.querySelector("[data-graview-app-link]") && !host.querySelector('[data-graview-app-state="asking"]')) break;
    await act(async () => void (await new Promise((done) => setTimeout(done, 10))));
  }
  return host;
}
const links = (host: HTMLElement) => [...host.querySelectorAll<HTMLElement>("[data-graview-app-link]")];

describe("an app-link field on a record's page", () => {
  it("draws the app the host names — its icon, name and home headline — linked to where it opens, not its address", async () => {
    const host = await open("/scenarios/outright");
    const [link] = links(host);
    expect(link?.getAttribute("data-graview-app-state")).toBe("found");
    expect(link?.tagName).toBe("A");
    expect(link?.getAttribute("href")).toBe("/a/nick/house");
    expect(link?.textContent).toBe("🏠12 Elm Street3 bed · offer accepted");
    expect(host.querySelector('[data-testid="record-fields"]')?.textContent).not.toContain("@nick/house");
    expect(asked).toEqual(["acct_me:@nick/house"]);
  });

  it("says 'linked app (no access)' where the host refuses this viewer, and nothing of the app", async () => {
    const host = await open("/scenarios/elsewhere");
    const [link] = links(host);
    expect(link?.getAttribute("data-graview-app-state")).toBe("denied");
    expect(link?.textContent).toBe("linked app (no access)");
    expect(link?.tagName).not.toBe("A");
  });

  it("draws the address plainly without a resolver: a link only when it is an absolute http(s) address", async () => {
    const named = links(await open("/scenarios/outright", false))[0];
    expect(named?.getAttribute("data-graview-app-state")).toBe("plain");
    expect(named?.textContent).toBe("@nick/house");
    expect(named?.tagName).toBe("SPAN");
    const web = links(await open("/scenarios/plain", false))[0];
    expect(web?.tagName).toBe("A");
    expect(web?.getAttribute("href")).toBe("https://example.com/listing");
  });
});

describe("an app-link on a list's rows", () => {
  it("names each record's app, asking the host once per address however many records link it", async () => {
    const host = await open("/scenarios");
    const states = links(host).map((link) => link.getAttribute("data-graview-app-state"));
    expect(states.sort()).toEqual(["denied", "found", "found", "plain"]);
    expect([...asked].sort()).toEqual(["acct_me:@ana/flat", "acct_me:@nick/house", "acct_me:https://example.com/listing"]);
  });
});
