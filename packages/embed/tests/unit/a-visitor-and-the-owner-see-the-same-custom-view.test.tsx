// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { createSchema, defineApp, defineNode, memoryViews, z, type Principal } from "@graview/core";
import { registerWorkerView, type WorkerViewManifest } from "@graview/guest/host/views";
import type { ReactViewRegistry } from "@graview/react";
import { act } from "react";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { mount, preload, type EmbedHandle, type EmbedOptions } from "../../src/index.js";

/**
 * A VISITOR AND THE OWNER SEE THE SAME CUSTOM VIEW (Roadmap
 * r-visitor-sees-lens-not-view, f-deleted-view-still-public). On a public
 * app a signed-out visitor was drawn a built-in page where its owner was
 * drawn the app's own view, and a home view the owner had deleted. What a
 * page draws at a place follows the views the host hands it and the views
 * it keeps, not who is looking: the owner, a member, a visitor with no
 * roles and a page that names nobody are drawn the same view at the home
 * and at a titled place — and none of them the home view the host lists
 * as deleted. Where a seat cannot see the kind a view attaches to, the
 * place is not offered to it at all, which the sight's own tests hold.
 */
URL.createObjectURL ??= () => "blob:test";
URL.revokeObjectURL ??= () => {};
(globalThis as { Worker?: unknown }).Worker ??= class {
  onmessage = null;
  onerror = null;
  postMessage() {}
  terminate() {}
  addEventListener() {}
  removeEventListener() {}
};

const player = defineNode("player", { fields: z.object({ label: z.string() }), plural: "Players" });
const season = defineNode("season", { fields: z.object({ label: z.string() }), plural: "Seasons" });
// Everybody sees every record; only the owner changes them.
const app = defineApp({ name: "Eagles", schema: createSchema([player, season]), mutations: [], policy: { grants: [{ roles: ["owner"], mutations: "*" }], sees: [{ roles: "*", kinds: ["player", "season"] }] } });
const seed = { nodes: [{ id: "p1", kind: "player", label: "Jalen" }, { id: "s1", kind: "season", label: "2025" }], edges: [] };
const source = "graview.onProps((props) => graview.render(graview.html`<p>${props.nodes.length}</p>`));";
const NEST: WorkerViewManifest = { name: "eagles-nest", title: "The nest", attach: "home", cardinality: "many", reads: { kinds: ["player", "season"] } };
const STORY: WorkerViewManifest = { name: "eagles-story", title: "Ninety-four seasons", attach: "home", cardinality: "many", reads: { kinds: ["season"] } };
const FACES: WorkerViewManifest = { name: "the-faces", title: "The faces", attach: "player", cardinality: "many", reads: { kinds: ["player"] } };
// As a host hands its views: every one it keeps, the deleted one among them until its days are up.
const views = (_schema: unknown, registry: ReactViewRegistry<never>) => {
  for (const manifest of [NEST, STORY, FACES]) registerWorkerView(registry as never, { manifest, worker: { source } });
  return registry;
};
const kept = () => memoryViews({ initial: { hidden: [], removed: [{ name: "eagles-story", title: "Ninety-four seasons", at: "2026-10-22T06:00:00.000Z", until: "2099-11-21T06:00:00.000Z" }] } });

const seats: Record<string, Principal | undefined> = {
  "the owner": { kind: "human", id: "person:owner", roles: ["owner"] },
  "a visitor with no roles": { kind: "visitor", id: "visitor:someone", roles: [] },
  "a page that names nobody": undefined,
};

beforeAll(() => preload("pages"), 60_000);

let handle: EmbedHandle | undefined;
let host: HTMLElement | undefined;
afterEach(async () => {
  await act(async () => handle?.unmount());
  host?.remove();
  handle = undefined;
  host = undefined;
});

async function viewDrawn(path: string, principal: Principal | undefined): Promise<string | null> {
  host = document.createElement("div");
  document.body.appendChild(host);
  await act(async () => {
    handle = mount(host!, { app, seed, fonts: false, studio: false, face: "pages", path, views, keptViews: kept(), ...(principal ? { principal } : {}) } as unknown as EmbedOptions);
  });
  for (let turn = 0; turn < 200 && !host.querySelector("[data-graview-embed]"); turn++) await act(async () => new Promise((resolve) => setTimeout(resolve, 10)));
  // The views the host keeps, and each view's region, arrive a turn or two after the first frame.
  for (let turn = 0; turn < 100 && !host.querySelector("[data-worker-view]"); turn++) await act(async () => new Promise((resolve) => setTimeout(resolve, 10)));
  await act(async () => new Promise((resolve) => setTimeout(resolve, 50)));
  return host.querySelector("[data-worker-view]")?.getAttribute("data-worker-view") ?? null;
}

describe("a visitor and the owner see the same custom view", () => {
  for (const [who, principal] of Object.entries(seats)) {
    it(`draws the home's live view for ${who}, never the one the host lists as deleted`, async () => {
      expect(await viewDrawn("/", principal)).toBe("eagles-nest");
    });

    it(`draws a titled place's view for ${who} where everybody sees its kind`, async () => {
      expect(await viewDrawn("/places/the-faces", principal)).toBe("the-faces");
    });
  }
});
