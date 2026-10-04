// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { bindSchema, createMemoryAdapter, createSchema, defineApp, defineNode, z, type SettingDeclaration } from "@graview/core";
import { createStoreHandler, openRemote } from "@graview/ship/runtime";
import { act } from "react";
import { beforeAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { mount, type EmbedHandle, type EmbedOptions, preload } from "../../src/index.js";

// Every face fetched before the first mount, so each draws in the commit `mount` makes (FR-57).
beforeAll(() => preload());

/**
 * AN EMBED HOLDS INSIDE A CHAT'S WIDGET (FR-13).
 *
 * The MCP Apps frame a ChatGPT or Claude widget runs in may refuse storage,
 * is sized from its content, and is told its theme over `postMessage`. An
 * embed that assumed the page's storage, filled a box it was given and read
 * the theme off a document it does not own held nowhere in it.
 */
const task = defineNode("task", { fields: z.object({ label: z.string() }), plural: "Tasks", label: (node: { label: string }) => node.label });
const schema = createSchema([task]);
const { defineMutation } = bindSchema(schema);
const add = defineMutation("add-task", {
  title: "Add a task",
  creates: ["task"],
  input: z.object({ id: z.string(), label: z.string() }),
  apply: (ctx, args) => void ctx.addNode({ id: args.id, kind: "task", label: args.label }),
});
const textSize: SettingDeclaration = {
  name: "text-size",
  title: "Text size",
  description: "How large the words are.",
  honoured: "root-font-size",
  options: [
    { value: "100%", label: "As your browser has it" },
    { value: "125%", label: "Larger" },
  ],
  initial: "100%",
};
const app = defineApp({ name: "Errands", schema, mutations: [add], settings: [textSize] });
const seed = { nodes: [{ id: "t1", kind: "task", label: "Post the letter" }], edges: [] };

/* ------------------------------------------------- a browser's geometry */

/** A ResizeObserver jsdom does not have, that a test can fire. */
class FakeResizeObserver {
  static all = new Set<FakeResizeObserver>();
  private watching = 0;
  constructor(private readonly callback: () => void) {
    FakeResizeObserver.all.add(this);
  }
  observe() {
    this.watching += 1;
  }
  unobserve() {}
  disconnect() {
    this.watching = 0;
  }
  static fire() {
    for (const one of [...FakeResizeObserver.all]) if (one.watching > 0) one.callback();
  }
}
const geometry = { width: 800, strip: 40, page: 400, content: 300 };
const realRect = HTMLElement.prototype.getBoundingClientRect;
beforeEach(() => {
  (globalThis as { ResizeObserver?: unknown }).ResizeObserver = FakeResizeObserver;
  Object.assign(geometry, { width: 800, strip: 40, page: 400, content: 300 });
  HTMLElement.prototype.getBoundingClientRect = function (this: HTMLElement) {
    const height = this.hasAttribute("data-embed-strip")
      ? geometry.strip
      : this.hasAttribute("data-embed-measure")
        ? geometry.page
        : this.hasAttribute("data-embed-content")
          ? geometry.content
          : 0;
    const width = this.hasAttribute("data-graview-embed") || this.hasAttribute("data-embed-strip") ? geometry.width : 0;
    return { x: 0, y: 0, top: 0, left: 0, right: width, bottom: height, width, height, toJSON() {} } as DOMRect;
  };
});
afterEach(() => {
  HTMLElement.prototype.getBoundingClientRect = realRect;
  delete (globalThis as { ResizeObserver?: unknown }).ResizeObserver;
  FakeResizeObserver.all.clear();
  delete document.documentElement.dataset["theme"];
});

const mounted: { handle: EmbedHandle; host: HTMLElement }[] = [];
afterEach(async () => {
  for (const { handle, host } of mounted.splice(0)) {
    await act(async () => handle.unmount());
    host.remove();
  }
});
async function mounting(options: Omit<EmbedOptions<typeof schema>, "app">) {
  const host = document.createElement("div");
  document.body.append(host);
  let handle!: EmbedHandle;
  await act(async () => {
    handle = mount(host, { app, fonts: false, ...options });
  });
  mounted.push({ handle, host });
  return { handle, host, root: host.querySelector<HTMLElement>("[data-graview-embed]")! };
}

/* ----------------------------------------------------------- the claims */

describe("an embed in a sandboxed frame", () => {
  it("mounts where touching localStorage or sessionStorage throws, on every face", async () => {
    const refuse = () => {
      throw new DOMException("The document is sandboxed and lacks the 'allow-same-origin' flag.", "SecurityError");
    };
    const local = Object.getOwnPropertyDescriptor(window, "localStorage");
    const session = Object.getOwnPropertyDescriptor(window, "sessionStorage");
    Object.defineProperty(window, "localStorage", { configurable: true, get: refuse });
    Object.defineProperty(window, "sessionStorage", { configurable: true, get: refuse });
    try {
      for (const face of ["pages", "graview", "scene"] as const) {
        const { root } = await mounting({ seed, face });
        expect(root.getAttribute("data-graview-embed")).toBe(face);
        expect(root.querySelector("[data-testid=embed-faces]"), "the strip").not.toBeNull();
        expect(root.textContent).toContain("Tasks");
      }
    } finally {
      if (local) Object.defineProperty(window, "localStorage", local);
      if (session) Object.defineProperty(window, "sessionStorage", session);
    }
  });

  it("keeps the reader's settings and session in the memory the host hands it", async () => {
    const kept = new Map<string, string>([["graview:setting:text-size", "125%"]]);
    const read: string[] = [];
    const memory = {
      getItem: (key: string) => (read.push(key), kept.get(key) ?? null),
      setItem: (key: string, value: string) => void kept.set(key, value),
    };
    await mounting({ seed, face: "pages", memory });
    expect(read).toContain("graview:setting:text-size");
    expect(kept.get("graview:session"), "this tab's session, kept by the host").toMatch(/\w+/);
    // The remembered answer was honoured: the root wears the larger size.
    expect(document.documentElement.style.fontSize).toBe("125%");
    document.documentElement.style.fontSize = "";
  });
});

describe("an embed sized from its content", () => {
  it("tells the host its height when it mounts and each time it changes", async () => {
    const told: number[] = [];
    await mounting({ seed, face: "pages", height: "auto", onIntrinsicHeight: (height) => told.push(height) });
    expect(told).toEqual([440]);
    geometry.page = 620;
    await act(async () => FakeResizeObserver.fire());
    expect(told).toEqual([440, 660]);
    // Nothing changed, nothing said.
    await act(async () => FakeResizeObserver.fire());
    expect(told).toEqual([440, 660]);
  });

  it("asks for the picture's box on the scene, and the page's on the pages face", async () => {
    const told: number[] = [];
    const { handle } = await mounting({ seed, face: "graview", onIntrinsicHeight: (height) => told.push(height) });
    expect(told.at(-1)).toBe(340);
    await act(async () => handle.setFace("pages"));
    expect(told.at(-1)).toBe(440);
  });
});

describe("an embed's scheme", () => {
  it("takes the host context's theme over the page's, and follows it", async () => {
    document.documentElement.dataset["theme"] = "light";
    const { handle, root } = await mounting({ seed, face: "pages", hostContext: { theme: "dark" } });
    expect(root.getAttribute("data-graview-scheme")).toBe("dark");
    await act(async () => handle.setHostContext({ theme: "light" }));
    expect(root.getAttribute("data-graview-scheme")).toBe("light");
  });

  it("follows the host page's data-theme as it changes", async () => {
    document.documentElement.dataset["theme"] = "light";
    const { root } = await mounting({ seed, face: "pages" });
    expect(root.getAttribute("data-graview-scheme")).toBe("light");
    await act(async () => {
      document.documentElement.dataset["theme"] = "dark";
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(root.getAttribute("data-graview-scheme")).toBe("dark");
  });
});

describe("an embed narrower than its scene", () => {
  it("shows the pages face below pagesBelow, and the scene again above it", async () => {
    geometry.width = 360;
    const { root } = await mounting({ seed, face: "graview", pagesBelow: 560 });
    expect(root.getAttribute("data-graview-embed")).toBe("pages");
    expect(root.querySelector("[data-testid=embed-face-scene]"), "no face to switch to").toBeNull();
    geometry.width = 900;
    await act(async () => FakeResizeObserver.fire());
    expect(root.getAttribute("data-graview-embed")).toBe("graview");
  });
});

describe("an embed over a remote store", () => {
  it("acts through the store a server holds", async () => {
    const handler = await createStoreHandler({ app, adapter: createMemoryAdapter(), seed: seed as never, trustSeatHeaders: true });
    const remote = await openRemote({
      app,
      url: "https://store.example",
      pollMs: 0,
      principal: { kind: "human", id: "nick" },
      fetch: ((url: string, init?: RequestInit) => handler.handle(new Request(url, init))) as typeof fetch,
    });
    const { handle, root } = await mounting({ face: "pages", remote });
    expect(handle.store).toBe(remote.store);
    expect(root.textContent).toContain("Tasks");
    await act(async () => void handle.store.apply({ name: "add-task", args: { id: "t2", label: "Water the fern" } }));
    await remote.settled();
    expect(handler.store.graph.getNode("t2")).toBeDefined();
    remote.close();
  });
});
