// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { createSchema, defineApp, defineNode, memoryViews, z, type KeptViews, type ViewForkKept } from "@graview/core";
import { act } from "react";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { GUEST_PROTOCOL, type HostHello } from "../../../guest/src/protocol.js";
import { mount, preload, type EmbedHandle, type EmbedOptions } from "../../src/index.js";

/**
 * A FORKED VIEW TAKES WHAT THE HOST SAYS OF EVERY VIEW (Graview HQ
 * f-forked-views-take-own-faces-off). Graview Cloud says `ownFaces: false`
 * on every worker view it registers, but a built-in page a person made its
 * own view of ("Make this page its own view") is registered by the embed
 * itself, from what `keptViews.forked` lists, with a definition of the
 * fork's manifest and code alone, so the host's word never reached it. The
 * host says it once, `forkedViews`, and each forked view takes it: its own
 * `@font-face` is refused as `own-face-refused`.
 */
class FakeWorker {
  static made: FakeWorker[] = [];
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  posted: { message: unknown; transfer: unknown[] }[] = [];
  constructor(readonly url: string) {
    FakeWorker.made.push(this);
  }
  postMessage(message: unknown, transfer: unknown[] = []) {
    this.posted.push({ message, transfer });
  }
  terminate() {}
  addEventListener() {}
  removeEventListener() {}
  say(data: unknown) {
    this.onmessage?.({ data } as MessageEvent);
  }
}
class FakeFontFace {
  readonly status = "unloaded";
  constructor(readonly family: string) {}
  load() {
    return Promise.resolve(this);
  }
}
let fonts: Set<unknown>;
beforeEach(() => {
  fonts = new Set();
  FakeWorker.made = [];
  Object.assign(window, { Worker: FakeWorker, FontFace: FakeFontFace });
  Object.assign(window.URL, { createObjectURL: () => "blob:https://host.example/1", revokeObjectURL: () => undefined });
  Object.defineProperty(document, "fonts", { value: { ready: Promise.resolve(), add: (face: unknown) => fonts.add(face), delete: (face: unknown) => fonts.delete(face) }, configurable: true });
});

const task = defineNode("task", { fields: z.object({ label: z.string() }), plural: "Tasks" });
const app = defineApp({ name: "Errands", schema: createSchema([task]), mutations: [] });
const seed = { nodes: [{ id: "t1", kind: "task", label: "Buy stamps" }], edges: [] };
const FORK: ViewForkKept = {
  manifest: { name: "home-page", attach: "home", cardinality: "many", reads: { kinds: ["task"] } },
  source: "graview.onProps((props) => graview.render(graview.html`<p>${props.nodes.length} tasks</p>`));",
  from: { page: "home" },
  said: "The home, made its own view.",
};
const font = `url(data:font/woff2;base64,${Buffer.from("wOF2".padEnd(2_000, "x")).toString("base64")})`;
const OWN_FACE = `@font-face { font-family: "Shout"; src: ${font} format("woff2") }\n.title { font-family: Shout, serif }`;

/** The host's keeper, listing one page made its own view. */
const keeping = (): KeptViews => ({ ...memoryViews({ may: { views: true, lenses: true } }), forked: () => [FORK] });

beforeAll(() => preload("pages"), 60_000);
let handle: EmbedHandle | undefined;
let host: HTMLElement | undefined;
afterEach(async () => {
  await act(async () => handle?.unmount());
  host?.remove();
  handle = undefined;
  host = undefined;
});

const wait = (ms: number) => act(async () => new Promise((resolve) => setTimeout(resolve, ms)));

/** The forked home drawn on the pages, its worker ready, and how to hand it a sheet with a face of its own. */
async function drawnWithAFace(options: Partial<EmbedOptions>) {
  host = document.body.appendChild(document.createElement("div"));
  await act(async () => {
    handle = mount(host!, { app, seed, fonts: false, studio: false, face: "pages", keptViews: keeping(), ...options } as EmbedOptions);
  });
  for (let turn = 0; turn < 300 && FakeWorker.made.length === 0; turn++) await wait(10);
  const worker = FakeWorker.made.at(-1);
  expect(worker, "the forked view's worker is started").toBeDefined();
  await act(async () => worker!.say({ graview: "guest-ready", protocol: GUEST_PROTOCOL }));
  const hello = worker!.posted[0]!.message as HostHello;
  const port = worker!.posted[0]!.transfer[0] as MessagePort;
  port.onmessage = (event) => {
    const data = event.data as { type?: string; beat?: number; push?: number };
    if (data.type === "heartbeat") port.postMessage({ type: "heartbeat", nonce: hello.nonce, beat: data.beat });
    if (data.type === "props" && typeof data.push === "number") port.postMessage({ type: "pushed", nonce: hello.nonce, push: data.push, ms: 3 });
  };
  return {
    style: async () => {
      port.postMessage({ type: "style", sheets: [OWN_FACE], nonce: hello.nonce });
      await wait(80);
    },
  };
}

describe("a page made its own view", () => {
  it("has its own face refused as own-face-refused where the host says ownFaces: false of forked views", async () => {
    const codes: string[] = [];
    const drawn = await drawnWithAFace({ forkedViews: { ownFaces: false, onProblem: (_said, problem) => void codes.push(problem.code) } });
    await drawn.style();
    expect(codes).toEqual(["own-face-refused"]);
    expect(fonts.size).toBe(0);
  });

  it("draws its own face, as before, where the host says nothing of forked views", async () => {
    const drawn = await drawnWithAFace({});
    await drawn.style();
    expect([...fonts].map((face) => (face as FakeFontFace).family)).toEqual([expect.stringMatching(/ Shout$/)]);
  });
});
