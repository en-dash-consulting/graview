// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { createSchema, defineApp, defineNode, z, type Principal } from "@graview/core";
import { registerWorkerView, type WorkerViewManifest } from "@graview/guest/host/views";
import type { ReactViewRegistry } from "@graview/react";
import { act } from "react";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { mount, preload, type EmbedHandle, type EmbedOptions } from "../../src/index.js";

/**
 * A STOPPED HOME VIEW FALLS BACK TO THE BUILT-IN HOME (Roadmap
 * f-view-budget-fair-to-visitors). An app that declares no home of its own,
 * whose home is a host's view: where the view was stopped, the host drew a
 * plain list of every record under "This view was stopped." Now the pages
 * face draws the app's built-in home in its place — the page
 * `?drawn=built-in` shows — marked with the view's name and why it stopped.
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
const app = defineApp({ name: "Eagles", schema: createSchema([player]), mutations: [], policy: { grants: [{ roles: ["owner"], mutations: "*" }], sees: [{ roles: "*", kinds: ["player"] }] } });
const seed = { nodes: [{ id: "p1", kind: "player", label: "Jalen" }, { id: "p2", kind: "player", label: "Saquon" }], edges: [] };
const NEST: WorkerViewManifest = { name: "eagles-nest", title: "The nest", attach: "home", cardinality: "many", reads: { kinds: ["player"] } };
/* Code longer than the view may be: stopped before it runs, as a view past any of its limits is. */
const views = (_schema: unknown, registry: ReactViewRegistry<never>) => registerWorkerView(registry as never, { manifest: NEST, worker: { source: "x".repeat(200) }, limits: { maxSourceBytes: 10 } });
const visitor: Principal = { kind: "visitor", id: "visitor:someone", roles: [] };

beforeAll(() => preload("pages"), 60_000);

let handle: EmbedHandle | undefined;
let host: HTMLElement | undefined;
afterEach(async () => {
  await act(async () => handle?.unmount());
  host?.remove();
  handle = undefined;
  host = undefined;
});

async function home(): Promise<HTMLElement> {
  host = document.createElement("div");
  document.body.appendChild(host);
  await act(async () => {
    handle = mount(host!, { app, seed, fonts: false, studio: false, face: "pages", path: "/", views, principal: visitor } as unknown as EmbedOptions);
  });
  for (let turn = 0; turn < 200 && !host.querySelector("[data-worker-view-fell-back]"); turn++) await act(async () => new Promise((resolve) => setTimeout(resolve, 10)));
  return host;
}

describe("a home view that stopped, on an app that declares no home", () => {
  it("is replaced by the app's built-in home, marked with the view and why", async () => {
    const page = await home();
    const fell = page.querySelector("[data-worker-view-fell-back]");
    expect(fell?.getAttribute("data-worker-view-fell-back")).toBe("eagles-nest");
    expect(fell?.getAttribute("data-worker-view-failed")).toBe("source");
    /* The built-in home's headline and its kinds, not a list under "This view was stopped". */
    expect(fell?.querySelector('[data-testid="standing"]')?.textContent).toBe("2 players.");
    expect(fell?.querySelector('[data-testid="kinds"]')).not.toBeNull();
    expect(page.querySelector('[data-testid="home-view"]')).toBeNull();
    const shadows = [...page.querySelectorAll("[data-worker-view-place] *")].map((one) => one.shadowRoot?.textContent ?? "").join("");
    expect(shadows).not.toMatch(/This view was stopped/);
  });
});
