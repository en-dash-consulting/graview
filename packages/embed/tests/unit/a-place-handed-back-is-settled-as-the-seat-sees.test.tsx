// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { createSchema, defineApp, defineNode, Store, z, type AnySchema, type GraviewApp, type Policy, type Principal } from "@graview/core";
import { fromUrl } from "@graview/layout/view";
import { act } from "react";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { mount, preload, type EmbedHandle, type EmbedOptions, type EmbedWhere } from "../../src/index.js";

/**
 * A PLACE HANDED BACK IS SETTLED AS THE SEAT SEES IT (FR-116, FR-55).
 *
 * `at` — and `setApp`, which hands the reader's place across a new
 * declaration — keeps a record that is still there and sends one that is
 * gone to its kind's list (on Pages) or its kind's group (in the scene).
 * "Still there" was asked of the whole store, so a record the seat may not
 * see was kept and one that does not exist was dropped: under address
 * routing, where the reader writes the address, that told a seat which
 * guessed ids were real. A record the seat may not see is gone for it, and
 * falls back the same way.
 */
const task = defineNode("task", { fields: z.object({ label: z.string() }), plural: "Tasks" });
const person = defineNode("person", { fields: z.object({ label: z.string() }), plural: "People" });
const policy: Policy = {
  grants: [{ roles: "*", mutations: "*" }],
  sees: [
    { roles: "*", kinds: ["task"] },
    { roles: "*", kinds: ["person"], own: true },
  ],
};
const app = defineApp({ name: "Errands", schema: createSchema([task, person]), mutations: [], policy } as never) as unknown as GraviewApp<AnySchema>;
const storeOf = () =>
  new Store<AnySchema>({
    schema: app.schema,
    mutations: [],
    policy,
    snapshot: { nodes: [{ id: "t1", kind: "task", label: "Buy stamps" }, { id: "p1", kind: "person", label: "Ada" }], edges: [] } as never,
  });
// A seat that is not p1, and so may not see Ada.
const stranger: Principal = { kind: "human", id: "p2", roles: [] };

beforeAll(() => preload());

const mounted: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const done of mounted.splice(0)) await done();
  window.history.replaceState(null, "", "/");
});

const tick = () => act(async () => new Promise((resolve) => setTimeout(resolve, 20)));

async function openAt(at: EmbedWhere, options: Partial<EmbedOptions> = {}, address = "/an-article"): Promise<EmbedHandle> {
  window.history.replaceState(null, "", address);
  const host = document.createElement("div");
  document.body.appendChild(host);
  let handle: EmbedHandle | undefined;
  await act(async () => {
    handle = mount(host, { app, store: storeOf(), principal: stranger, fonts: false, studio: false, at, ...options } as EmbedOptions);
  });
  let drawn = false;
  void handle!.drawn().then(() => (drawn = true));
  for (let n = 0; n < 50 && !drawn; n++) await tick();
  expect(drawn).toBe(true);
  await tick();
  mounted.push(async () => {
    await act(async () => handle!.unmount());
    host.remove();
  });
  return handle!;
}

describe("a place handed back, for a seat that may not see a record in it", () => {
  it("sends a page on a record the seat may not see to its kind's list, as it does one that is not there", async () => {
    const hidden = await openAt({ face: "pages", path: "/people/p1", stop: "#" });
    const absent = await openAt({ face: "pages", path: "/people/p9", stop: "#" });
    expect(absent.where().path).toBe("/people");
    expect(hidden.where().path).toBe(absent.where().path);
  });

  it("sends the scene's focus on a record the seat may not see to its kind's group, as it does one that is not there", async () => {
    const hidden = await openAt({ face: "scene", path: "/", stop: "#focus=p1", kind: "person" });
    const absent = await openAt({ face: "scene", path: "/", stop: "#focus=p9", kind: "person" });
    expect(fromUrl(absent.where().stop).focusId).toBe("aggregate:person");
    expect(fromUrl(hidden.where().stop).focusId).toBe(fromUrl(absent.where().stop).focusId);
  });

  it("under address routing, rewrites an address naming a record the seat may not see as it does one naming none", async () => {
    await openAt({ face: "pages", path: "/people/p1", stop: "#" }, { routing: "address", basePath: "/apps/a1" }, "/apps/a1/people/p1");
    expect(window.location.pathname).toBe("/apps/a1/people");
  });
});
