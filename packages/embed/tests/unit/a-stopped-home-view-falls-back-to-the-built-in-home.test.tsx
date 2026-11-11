// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { createSchema, defineApp, defineNode, z, type Principal } from "@graview/core";
import { GUEST_PROTOCOL } from "@graview/guest";
import { registerWorkerView, type WorkerViewDefinition, type WorkerViewManifest } from "@graview/guest/host/views";
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
 * `?drawn=built-in` shows — marked with the view's name and why it stopped:
 * a view stopped before it ran, and one stopped as slow after it had drawn.
 * Once it has fallen back, the built-in home stays for the page's life.
 */
URL.createObjectURL ??= () => "blob:test";
URL.revokeObjectURL ??= () => {};
/** The view's worker, which the test speaks for. */
class FakeWorker {
  static made: FakeWorker[] = [];
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  posted: { message: unknown; transfer: unknown[] }[] = [];
  constructor() {
    FakeWorker.made.push(this);
  }
  postMessage(message: unknown, transfer: unknown[] = []) {
    this.posted.push({ message, transfer });
  }
  terminate() {}
  addEventListener() {}
  removeEventListener() {}
}
(globalThis as { Worker?: unknown }).Worker = FakeWorker;

const player = defineNode("player", { fields: z.object({ label: z.string() }), plural: "Players" });
const app = defineApp({ name: "Eagles", schema: createSchema([player]), mutations: [], policy: { grants: [{ roles: ["owner"], mutations: "*" }], sees: [{ roles: "*", kinds: ["player"] }] } });
const seed = { nodes: [{ id: "p1", kind: "player", label: "Jalen" }, { id: "p2", kind: "player", label: "Saquon" }], edges: [] };
const NEST: WorkerViewManifest = { name: "eagles-nest", title: "The nest", attach: "home", cardinality: "many", reads: { kinds: ["player"] } };
const visitor: Principal = { kind: "visitor", id: "visitor:someone", roles: [] };
const viewsOf = (definition: WorkerViewDefinition) => (_schema: unknown, registry: ReactViewRegistry<never>) => registerWorkerView(registry as never, definition);

beforeAll(() => preload("pages"), 60_000);

let handle: EmbedHandle | undefined;
let host: HTMLElement | undefined;
afterEach(async () => {
  await act(async () => handle?.unmount());
  host?.remove();
  handle = undefined;
  host = undefined;
  FakeWorker.made = [];
});

const turn = (ms = 10) => act(async () => new Promise((resolve) => setTimeout(resolve, ms)));
const until = async (done: () => boolean) => {
  for (let at = 0; at < 300 && !done(); at++) await turn();
};
/** What the view drew, in the region the host keeps it in. */
const drawnText = (page: HTMLElement) => [...page.querySelectorAll("*")].map((one) => one.shadowRoot?.textContent ?? "").join("");

async function home(definition: WorkerViewDefinition): Promise<HTMLElement> {
  host = document.createElement("div");
  document.body.appendChild(host);
  await act(async () => {
    handle = mount(host!, { app, seed, fonts: false, studio: false, face: "pages", path: "/", views: viewsOf(definition), principal: visitor } as unknown as EmbedOptions);
  });
  return host;
}

function expectTheBuiltInHome(page: HTMLElement, reason: string) {
  const fell = page.querySelector("[data-worker-view-fell-back]");
  expect(fell?.getAttribute("data-worker-view-fell-back")).toBe("eagles-nest");
  expect(fell?.getAttribute("data-worker-view-failed")).toBe(reason);
  /* The built-in home's headline and its kinds, not a list under "This view was stopped". */
  expect(fell?.querySelector('[data-testid="standing"]')?.textContent).toBe("2 players.");
  expect(fell?.querySelector('[data-testid="kinds"]')).not.toBeNull();
  expect(page.querySelector('[data-testid="home-view"]')).toBeNull();
  expect(drawnText(page)).not.toMatch(/This view was stopped/);
}

describe("a home view that stopped, on an app that declares no home", () => {
  it("is replaced by the app's built-in home, marked with the view and why, when it was stopped before it ran", async () => {
    /* Code longer than the view may be: stopped before it runs, as a view past any of its limits is. */
    const page = await home({ manifest: NEST, worker: { source: "x".repeat(200) }, limits: { maxSourceBytes: 10 } });
    await until(() => page.querySelector("[data-worker-view-fell-back]") !== null);
    expectTheBuiltInHome(page, "source");
  });

  it("is replaced by the built-in home when it is stopped as slow after it has drawn, and the built-in home stays", async () => {
    const page = await home({ manifest: NEST, worker: { source: "/* the nest */" }, limits: { pushMs: 1_000 } });
    await until(() => FakeWorker.made.length > 0);
    const worker = FakeWorker.made.at(-1)!;
    await act(async () => worker.onmessage?.({ data: { graview: "guest-ready", protocol: GUEST_PROTOCOL } } as MessageEvent));
    const hello = worker.posted[0]!.message as { nonce: string };
    const port = worker.posted[0]!.transfer[0] as MessagePort;
    /* Each push drawn, and said to have taken longer than the view may take: the first is drawn before it is said. */
    const pushes: number[] = [];
    port.onmessage = (event) => {
      const data = event.data as { type?: string; beat?: number; push?: number };
      if (data.type === "heartbeat") port.postMessage({ type: "heartbeat", nonce: hello.nonce, beat: data.beat });
      if (data.type === "props" && typeof data.push === "number") {
        pushes.push(data.push);
        port.postMessage({ type: "render", nonce: hello.nonce, records: [[0, "~", { id: "n1", type: 1, element: "p", attributes: {}, children: [{ id: "n2", type: 3, data: "The nest, drawn" }] }, 0]] });
      }
    };
    await until(() => drawnText(page).includes("The nest, drawn"));
    expect(drawnText(page)).toContain("The nest, drawn");
    expect(page.querySelector("[data-worker-view-fell-back]")).toBeNull();
    await act(async () => port.postMessage({ type: "pushed", nonce: hello.nonce, push: pushes[0], ms: 60_000 }));
    await until(() => page.querySelector("[data-worker-view-fell-back]") !== null);
    expectTheBuiltInHome(page, "slow");
    expect(drawnText(page)).not.toContain("The nest, drawn");
    /* It does not flap back to the view that stopped: the page draws the built-in home while it lives, the home left and come back to. */
    await turn(200);
    expectTheBuiltInHome(page, "slow");
    const made = FakeWorker.made.length;
    await act(async () => (page.querySelector('[data-testid="kinds"] a') as HTMLElement).click());
    await until(() => page.querySelector('[data-testid="kinds"]') === null);
    expect(page.querySelector('[data-testid="kinds"]')).toBeNull();
    /* Back by the bar's own Home. */
    const homeButton = [...page.querySelectorAll("button")].find((one) => one.textContent?.trim() === "Home");
    expect(homeButton).toBeDefined();
    await act(async () => homeButton!.click());
    await until(() => page.querySelector('[data-testid="kinds"]') !== null);
    await turn(100);
    expectTheBuiltInHome(page, "slow");
    expect(FakeWorker.made.length).toBe(made);
  });
});
