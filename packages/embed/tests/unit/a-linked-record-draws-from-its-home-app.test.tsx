// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { Store, type AnySchema, type LinkedRecordRef, type Principal } from "@graview/core";
import { compileDocument } from "@graview/core/check";
import { linkedRecordsOver, recordLinkedChange } from "@graview/core/linked";
import { act } from "react";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { mount, preload, type EmbedHandle } from "../../src/index.js";

beforeAll(() => preload());

/**
 * FR-171. A RECORD IN ANOTHER APP DRAWS WITH ITS OWN CARD.
 *
 * A scenario's `forHouse` goes to `@nick/house/house`. The host hands
 * `linkedRecords`, which reads the house app as the viewer: on the
 * scenario's page the house draws with its own label, describe line and a
 * glance at its fields from its home app; the price the scenario works out
 * through the link reads the far value; pressing the house opens it
 * through the host. A viewer who may not open the house app sees "linked
 * record (no access)" and nothing of the house — not its name, not its
 * price, not the price worked out from it.
 */
function compiled(doc: unknown) {
  const result = compileDocument(doc);
  if (!result.ok) throw new Error(`compiles: ${JSON.stringify(result.findings)}`);
  return result.app;
}
const houseApp = compiled({
  format: "graview-document",
  formatVersion: 1,
  name: "House",
  kinds: { house: { fields: { street: { type: "string", required: true }, bedrooms: { type: "integer" }, listPrice: { type: "number" } }, label: "{street}", describe: "{bedrooms} bedrooms" } },
  acts: { "add-house": { creates: "house" } },
});
const houses = new Store<AnySchema>({
  schema: houseApp.schema as AnySchema,
  snapshot: { nodes: [{ id: "h1", kind: "house", street: "12 Elm Street", bedrooms: 3, listPrice: 450000 }, { id: "h2", kind: "house", street: "4 Oak Lane", bedrooms: 2, listPrice: 320000 }], edges: [] } as never,
});
const scenarioApp = compiled({
  format: "graview-document",
  formatVersion: 1,
  name: "Purchase scenarios",
  kinds: {
    scenario: {
      fields: { name: { type: "string", required: true } },
      edges: { forHouse: { to: ["@nick/house/house"], cardinality: "one" } },
      computed: { price: { expr: "forHouse.listPrice", label: "Asking price" } },
    },
  },
  acts: { "add-scenario": { title: "Add a scenario", creates: "scenario" } },
});
const seed = { nodes: [{ id: "outright", kind: "scenario", name: "Buy it outright", forHouse: "house:h1" }], edges: [] };
const OWNER: Principal = { kind: "human", id: "acct_owner", roles: ["owner"] };
const GUEST: Principal = { kind: "human", id: "acct_guest", roles: ["guest"] };

const opened: LinkedRecordRef[] = [];
const host = linkedRecordsOver(
  { "@nick/house": { store: houses, name: "House", opens: (viewer) => (viewer.roles ?? []).includes("owner"), href: (ref) => `/a/nick/house/${ref.id}` } },
  { open: (ref) => void opened.push(ref) },
);

const mounted: { handle: EmbedHandle; element: HTMLElement }[] = [];
afterEach(async () => {
  for (const { handle, element } of mounted.splice(0)) {
    await act(async () => handle.unmount());
    element.remove();
  }
  opened.length = 0;
});
async function open(path: string, principal: Principal, store?: Store<AnySchema>) {
  const element = document.createElement("div");
  document.body.append(element);
  let handle!: EmbedHandle;
  await act(async () => {
    handle = mount(element, { app: scenarioApp as never, ...(store ? { store: store as never } : { seed: seed as never }), face: "pages", path, principal, fonts: false, studio: false, linkedRecords: host });
  });
  mounted.push({ handle, element });
  for (let i = 0; i < 100; i++) {
    if (element.querySelector("[data-graview-linked]") && !element.querySelector('[data-graview-linked-state="asking"]')) break;
    await act(async () => void (await new Promise((done) => setTimeout(done, 10))));
  }
  await act(async () => void (await new Promise((done) => setTimeout(done, 20))));
  return element;
}

describe("a record in another app on a record's page", () => {
  it("draws with its own card and describe line from its home app, and never what the link keeps", async () => {
    const element = await open("/scenarios/outright", OWNER);
    const linked = element.querySelector<HTMLElement>("[data-graview-linked]");
    expect(linked?.getAttribute("data-graview-linked-state")).toBe("found");
    expect(linked?.querySelector("[data-graview-linked-title]")?.textContent).toBe("12 Elm Street");
    expect(linked?.querySelector("[data-graview-linked-describe]")?.textContent).toBe("3 bedrooms");
    expect(linked?.querySelector("[data-graview-linked-app]")?.textContent).toBe("in House");
    expect(linked?.querySelector("[data-graview-linked-card]")?.textContent).toMatch(/List price\s*450,?000/);
    expect(element.textContent).not.toContain("house:h1");
  });

  it("works out a value through the link as the viewer", async () => {
    const element = await open("/scenarios/outright", OWNER);
    expect(element.querySelector('[data-testid="record-fields"]')?.textContent).toMatch(/Asking price\s*450,?000/);
  });

  it("opens through the host when pressed: the navigation seam, not the reading app's router", async () => {
    const element = await open("/scenarios/outright", OWNER);
    const title = element.querySelector<HTMLAnchorElement>("[data-graview-linked-title]")!;
    expect(title.getAttribute("href")).toBe("/a/nick/house/h1");
    await act(async () => title.click());
    expect(opened).toEqual([{ address: "@nick/house", kind: "house", id: "h1" }]);
  });

  it("keeps a far value's change in the record's history, said as the far app's", async () => {
    const store = new Store<AnySchema>({ schema: scenarioApp.schema as AnySchema, mutations: scenarioApp.mutations ?? [], snapshot: seed as never });
    const element = await open("/scenarios/outright", OWNER, store);
    await act(async () => void recordLinkedChange(store, { ref: { address: "@nick/house", kind: "house", id: "h1" }, fields: ["listPrice"], app: "House" }));
    expect(element.textContent).toContain("Buy it outright: the linked record changed in House — list price");
  });

  it("says 'linked record (no access)' to a viewer who may not open the far app, and nothing of the record", async () => {
    const element = await open("/scenarios/outright", GUEST);
    const linked = element.querySelector<HTMLElement>("[data-graview-linked]");
    expect(linked?.getAttribute("data-graview-linked-state")).toBe("denied");
    expect(linked?.textContent).toBe("linked record (no access)");
    expect(element.textContent).not.toMatch(/Elm|450,?000|3 bedrooms/);
  });
});
