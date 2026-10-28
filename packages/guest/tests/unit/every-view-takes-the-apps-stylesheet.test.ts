// @vitest-environment jsdom
import { createSchema, defineNode, Store, z, type AnySchema, type Principal } from "@graview/core";
import { CSS_DRAWN_AS, sanitizeStylesheet } from "@graview/core/css";
import { afterEach, describe, expect, it } from "vitest";
import { runWorkerViewHeadless } from "../../src/headless/index.js";
import { nodeIsolate } from "../../src/headless/node.js";
import { createOpenDrawing, FADE_MS, REGION_CSS } from "../../src/host/open-draw.js";
import { mountWorkerView, type MountWorkerViewOptions } from "../../src/host/view.js";
import { HTML_DRAWN_AS } from "../../src/open-kit.js";
import { GUEST_PROTOCOL, type HostHello } from "../../src/protocol.js";

/*
 * EVERY VIEW TAKES THE APP'S STYLESHEET (Roadmap f-app-wide-view-theme).
 * Each custom view carried its own copy of the stylesheet, so a polished
 * home and the record pages drifted apart. The brand now names what every
 * worker view inherits (`Brand.views`): a stylesheet the host draws in the
 * view's region before the view's own — through the one sanitizer, so the
 * view's rule wins where both say one and nothing in it reaches further
 * than a view's could — and `motion: "fade"`, under which the host fades
 * the drawing out when the record it shows changes and in once the view
 * has drawn the new one. The view is never told; the host dresses it, and
 * dresses it again when the brand changes. A headless run draws the same
 * sheet first, so a picture of the view is dressed as the page dresses it.
 */
const THEME = ".card { background: var(--graview-panel); padding: 12px }\nh2 { letter-spacing: 0.02em }";
const LEAKY = `${THEME}\n.card { background: url(https://attacker.example/paper.png) }`;
const OWN = ".card { padding: 20px }";

const car = defineNode("car", { fields: z.object({ label: z.string() }), plural: "Cars", label: (node) => node.label });
const schema = createSchema([car]);
const CARS = [
  { id: "car:golf", kind: "car", label: "Golf" },
  { id: "car:polo", kind: "car", label: "Polo" },
];
const store = () => new Store<AnySchema>({ schema: schema as AnySchema, mutations: [], policy: { grants: [] }, snapshot: { nodes: CARS, edges: [] } as never });
const reader: Principal = { kind: "human", id: "u:reader" };
const manifest = { name: "card", title: "The card", attach: "car", cardinality: "one" } as const;

let ids = 0;
const element = (name: string, attributes: Record<string, string> = {}, children: unknown[] = []) => ({ id: `c${(ids += 1)}`, type: 1, element: name, attributes, children });
const text = (data: string) => ({ id: `c${(ids += 1)}`, type: 3, data });
const cardOf = (label: string) => [[0, "~", element("div", { class: "card" }, [element("h2", {}, [text(label)])]), 0]];
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("the drawing's theme", () => {
  it("is a stylesheet of the host's between the region's rules and the view's own, judged as the view's is, so the view's rule wins where both say one and nothing that fetches is drawn", () => {
    const shadow = document.body.appendChild(document.createElement("div")).attachShadow({ mode: "open" });
    const drawing = createOpenDrawing(shadow, { origin: "https://app.example", send: () => {} });
    drawing.theme(LEAKY);
    drawing.style([OWN]);
    const sheets = [...shadow.querySelectorAll("style")].map((one) => [one.getAttributeNames().find((name) => name.startsWith("data-graview"))!, one.textContent!] as const);
    expect(sheets.map(([name]) => name)).toEqual(["data-graview-region", "data-graview-view-theme", "data-graview-view-style"]);
    const themed = sheets[1]![1];
    expect(themed).toBe(sanitizeStylesheet(LEAKY).css);
    expect(themed).toContain("padding: 12px");
    expect(themed).not.toContain("attacker.example");
    expect(sheets[2]![1]).toContain("padding: 20px");
    /* The view's refusals are its own: the theme's were the checker's to say. */
    expect(drawing.refused).toEqual([]);
    drawing.theme(undefined);
    expect(shadow.querySelector("[data-graview-view-theme]")!.textContent).toBe("");
    drawing.dispose();
  });

  it("fades the drawing out when told the record changes, and in once the next batch has drawn, under motion fade alone", async () => {
    const shadow = document.body.appendChild(document.createElement("div")).attachShadow({ mode: "open" });
    const drawing = createOpenDrawing(shadow, { origin: "https://app.example", send: () => {} });
    const root = shadow.querySelector("[data-graview-view-root]")!;
    /* Nothing drawn yet, and no motion asked for: a fade is nothing. */
    drawing.fade();
    expect(root.hasAttribute("data-graview-fade")).toBe(false);
    drawing.motion("fade");
    expect(root.getAttribute("data-graview-motion")).toBe("fade");
    drawing.fade();
    expect(root.hasAttribute("data-graview-fade")).toBe(false);
    drawing.apply(cardOf("Golf"));
    drawing.fade();
    expect(root.hasAttribute("data-graview-fade")).toBe(true);
    drawing.apply(cardOf("Polo"));
    /* Drawn while faded out; in again once the fade out has run its course. */
    expect(root.hasAttribute("data-graview-fade")).toBe(true);
    await wait(FADE_MS + 60);
    expect(root.hasAttribute("data-graview-fade")).toBe(false);
    expect(root.firstElementChild?.textContent).toBe("Polo");
    /* A view that draws nothing new is not left invisible. */
    drawing.fade();
    await wait(FADE_MS * 4 + 60);
    expect(root.hasAttribute("data-graview-fade")).toBe(false);
    drawing.motion("none");
    expect(root.hasAttribute("data-graview-motion")).toBe(false);
    drawing.dispose();
  });

  it("is a transition of the root alone, held to the reduced-motion rule like every motion in a view", () => {
    expect(REGION_CSS).toContain(`[data-graview-view-root][data-graview-motion="fade"] { transition: opacity ${FADE_MS}ms ease; }`);
    expect(REGION_CSS).toContain("[data-graview-view-root][data-graview-fade] { opacity: 0; }");
    expect(REGION_CSS).toMatch(/prefers-reduced-motion: reduce\) \{ \[data-graview-view-root\], \[data-graview-view-root\] \*/);
  });

  it("reads a selector's drawn-as elements as the host draws them: the sanitizer's table is the open kit's", () => {
    expect(CSS_DRAWN_AS).toEqual(HTML_DRAWN_AS);
  });
});

/* The worker's stand-in: the host's half runs for real, over a MessagePort. */
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
  say(data: unknown) {
    this.onmessage?.({ data } as MessageEvent);
  }
}
Object.assign(window, { Worker: FakeWorker });
Object.assign(window.URL, { createObjectURL: () => "blob:https://host.example/1", revokeObjectURL: () => undefined });
const live: { dispose(): void }[] = [];
afterEach(() => {
  for (const one of live.splice(0)) one.dispose();
  FakeWorker.made = [];
  document.body.replaceChildren();
});

/** The view mounted on a page: the host's region, pushed what it is shown, drawing what the worker's stand-in sends. */
async function onThePage(brand: { current: MountWorkerViewOptions<AnySchema>["brand"] }, shown: { current: string }) {
  const element = document.createElement("div");
  document.body.appendChild(element);
  const view = mountWorkerView(element, { manifest, worker: { script: "/* the view */" }, store: store(), principal: reader, input: () => ({ node: { id: shown.current } }), brand: () => brand.current?.() });
  live.push(view);
  const worker = FakeWorker.made.at(-1)!;
  worker.say({ graview: "guest-ready", protocol: GUEST_PROTOCOL });
  const hello = worker.posted[0]!.message as HostHello;
  const port = worker.posted[0]!.transfer[0] as MessagePort;
  let pushes = 0;
  port.onmessage = (event) => {
    const data = event.data as { type?: string; beat?: number; push?: number };
    if (data.type === "heartbeat") port.postMessage({ type: "heartbeat", nonce: hello.nonce, beat: data.beat });
    if (data.type === "props" && typeof data.push === "number") {
      pushes += 1;
      port.postMessage({ type: "pushed", nonce: hello.nonce, push: data.push, ms: 1 });
    }
  };
  const render = async (label: string) => {
    port.postMessage({ type: "render", nonce: hello.nonce, records: cardOf(label) });
    for (let i = 0; i < 50 && view.shadow.querySelector("[data-graview-view-root]")?.firstElementChild?.textContent !== label; i += 1) await wait(10);
  };
  for (let i = 0; i < 50 && pushes === 0; i += 1) await wait(10);
  await render("Golf");
  return {
    view,
    render,
    pushes: () => pushes,
    theme: () => view.shadow.querySelector("[data-graview-view-theme]")!.textContent,
    root: () => view.shadow.querySelector("[data-graview-view-root]")!,
  };
}

describe("a worker view on a page", () => {
  it("is dressed in the brand's stylesheet for every view before its own, and undressed when the brand loses it", async () => {
    const brand = { current: () => ({ name: "Showroom", views: { css: THEME } }) as ReturnType<NonNullable<MountWorkerViewOptions<AnySchema>["brand"]>> };
    const { view, theme, root } = await onThePage(brand, { current: "car:golf" });
    expect(theme()).toBe(sanitizeStylesheet(THEME).css);
    expect(root().hasAttribute("data-graview-motion")).toBe(false);
    brand.current = () => ({ name: "Showroom" });
    view.update();
    await wait(20);
    expect(theme()).toBe("");
  });

  it("fades between records where the brand asks for it: out when the record it is shown changes, in once it has drawn the new one", async () => {
    const brand = { current: () => ({ name: "Showroom", views: { css: THEME, motion: "fade" as const } }) };
    const shown = { current: "car:golf" };
    const { view, render, root, pushes } = await onThePage(brand, shown);
    expect(root().getAttribute("data-graview-motion")).toBe("fade");
    expect(root().hasAttribute("data-graview-fade")).toBe(false);
    /* The same record pushed again (the app's toggle, a brand change) is no change of record: nothing fades. */
    const before = pushes();
    view.update();
    for (let i = 0; i < 50 && pushes() === before; i += 1) await wait(10);
    expect(root().hasAttribute("data-graview-fade")).toBe(false);
    shown.current = "car:polo";
    view.update();
    for (let i = 0; i < 50 && !root().hasAttribute("data-graview-fade"); i += 1) await wait(10);
    expect(root().hasAttribute("data-graview-fade")).toBe(true);
    await render("Polo");
    await wait(FADE_MS + 60);
    expect(root().hasAttribute("data-graview-fade")).toBe(false);
    expect(root().firstElementChild?.textContent).toBe("Polo");
  });
});

describe("a headless run", () => {
  it("draws the brand's stylesheet for every view before the view's own in its css, so a picture of the view is dressed as the page dresses it", async () => {
    const source = `graview.style(${JSON.stringify(OWN)}); graview.onProps((props) => graview.render(graview.html\`<div class="card"><h2>\${props.node.label}</h2></div>\`));`;
    const dressed = await runWorkerViewHeadless({ store: store(), principal: reader, manifest, input: { node: { id: "car:golf" } }, source, run: nodeIsolate(), brand: { views: { css: LEAKY, motion: "fade" } } });
    if (!dressed.ok) throw new Error(dressed.detail);
    expect(dressed.css).toBe(`${sanitizeStylesheet(LEAKY).css}\n${sanitizeStylesheet(OWN).css}`);
    expect(dressed.css).not.toContain("attacker.example");
    /* The theme's refusals are the checker's (brand-views-css), never this view's problems. */
    expect(dressed.description.problems).toEqual([]);
    const bare = await runWorkerViewHeadless({ store: store(), principal: reader, manifest, input: { node: { id: "car:golf" } }, source, run: nodeIsolate() });
    if (!bare.ok) throw new Error(bare.detail);
    expect(bare.css).toBe(sanitizeStylesheet(OWN).css);
  });
});
