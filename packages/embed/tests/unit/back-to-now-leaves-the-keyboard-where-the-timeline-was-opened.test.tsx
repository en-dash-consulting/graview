// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { bindSchema, createSchema, defineApp, defineNode, Store, z } from "@graview/core";
import { act } from "react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { mount, preload, type EmbedHandle, type EmbedOptions } from "../../src/index.js";

beforeAll(() => preload());
(Element.prototype as { scrollTo?: unknown }).scrollTo = () => {};

/**
 * "BACK TO NOW" LEAVES THE KEYBOARD WHERE THE TIMELINE WAS OPENED (Graview
 * HQ f-playback-watch-problems). The timeline closes when "Back to now" is
 * pressed, and the button goes with it, so the keyboard was left on
 * `<body>`: a person who pressed it had to find their place again from the
 * top of the page. It goes back to what opened the timeline, or, where that
 * is gone (a menu row, closed with its menu), to the app menu's button the
 * timeline is opened from. And the scrubber is a target a finger can hit:
 * 24 pixels tall, where a browser's range input is less.
 */
const note = defineNode("note", { fields: z.object({ label: z.string() }), plural: "Notes" });
const schema = createSchema([note]);
const { defineMutation } = bindSchema(schema);
const addNote = defineMutation("add-note", {
  title: "Add a note",
  creates: ["note"],
  input: z.object({ label: z.string().min(1) }),
  apply(ctx, args) {
    ctx.addNode({ id: `note-${args.label}`, kind: "note", label: args.label } as never);
  },
});
const app = defineApp({ name: "Field notes", schema, mutations: [addNote] });
const me = { kind: "human" as const, id: "me" };
function written() {
  const store = new Store({ schema, mutations: [addNote], invariants: [], snapshot: { nodes: [], edges: [] } });
  for (const label of ["First", "Second"]) store.apply({ name: "add-note", args: { label } }, { author: me });
  return store;
}

async function settled(holds: () => void, ms = 5000): Promise<void> {
  for (const end = Date.now() + ms; ; ) {
    await act(async () => {
      await vi.dynamicImportSettled();
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    try {
      holds();
      return;
    } catch (error) {
      if (Date.now() > end) throw error;
    }
  }
}
const click = (element: Element | null | undefined) => act(async () => (element as HTMLElement).click());
const timeline = (host: Element) => host.querySelector('[data-testid="timeline"]');

async function opened(face: "pages" | "scene") {
  const host = document.body.appendChild(document.createElement("div"));
  let handle: EmbedHandle | undefined;
  await act(async () => {
    handle = mount(host, { app, fonts: false, face, ...(face === "pages" ? { path: "/notes" } : {}), store: written(), principal: me } as unknown as EmbedOptions);
  });
  await settled(() => expect(host.querySelector('[data-testid="app-menu-open"]')).not.toBeNull());
  await click(host.querySelector('[data-testid="app-menu-open"]'));
  await settled(() => expect(host.querySelector('[data-testid="app-menu"] [data-testid="app-menu-history"]')).not.toBeNull());
  await click(host.querySelector('[data-testid="app-menu"] [data-testid="app-menu-history"]'));
  await settled(() => expect(document.activeElement).toBe(host.querySelector('[data-testid="scrubber"]')));
  return {
    host,
    done: async () => {
      await act(async () => handle!.unmount());
      host.remove();
      sessionStorage.clear();
    },
  };
}

describe('"Back to now"', () => {
  for (const face of ["pages", "scene"] as const) {
    it(`leaves the keyboard on the app menu's button the timeline was opened from, never on <body>, on the ${face} face`, { timeout: 30_000 }, async () => {
      const { host, done } = await opened(face);
      try {
        await click(host.querySelector('[data-testid="back-to-now"]'));
        await settled(() => expect(timeline(host)).toBeNull());
        expect(document.activeElement).not.toBe(document.body);
        expect(document.activeElement).toBe(host.querySelector('[data-testid="app-menu-open"]'));
      } finally {
        await done();
      }
    });
  }

  it("leaves the keyboard on a host's own button that opened the timeline (showHistory), outside the embed", { timeout: 30_000 }, async () => {
    const host = document.body.appendChild(document.createElement("div"));
    const own = document.body.appendChild(document.createElement("button"));
    own.textContent = "History";
    let handle: EmbedHandle | undefined;
    await act(async () => {
      handle = mount(host, { app, fonts: false, face: "pages", path: "/notes", store: written(), principal: me } as unknown as EmbedOptions);
    });
    try {
      await settled(() => expect(host.querySelector('[data-testid="app-menu-open"]')).not.toBeNull());
      own.focus();
      await act(async () => void handle!.showHistory());
      await settled(() => expect(timeline(host)).not.toBeNull());
      host.querySelector<HTMLElement>('[data-testid="back-to-now"]')!.focus();
      await click(host.querySelector('[data-testid="back-to-now"]'));
      await settled(() => expect(timeline(host)).toBeNull());
      expect(document.activeElement).toBe(own);
    } finally {
      await act(async () => handle!.unmount());
      host.remove();
      own.remove();
      sessionStorage.clear();
    }
  });
});

describe('"Restore to here"', () => {
  it("leaves the keyboard on the app menu's button, never on <body>", { timeout: 30_000 }, async () => {
    const { host, done } = await opened("pages");
    try {
      const scrubber = host.querySelector<HTMLInputElement>('[data-testid="scrubber"]')!;
      await act(async () => {
        const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
        set.call(scrubber, "1");
        scrubber.dispatchEvent(new Event("input", { bubbles: true }));
      });
      await settled(() => expect(host.querySelector('[data-testid="restore-here"]')).not.toBeNull());
      host.querySelector<HTMLElement>('[data-testid="restore-here"]')!.focus();
      await click(host.querySelector('[data-testid="restore-here"]'));
      await settled(() => expect(timeline(host)).toBeNull());
      expect(document.activeElement).toBe(host.querySelector('[data-testid="app-menu-open"]'));
    } finally {
      await done();
    }
  });
});

describe("the scrubber", () => {
  it("is 24 pixels tall, a target a finger can hit", { timeout: 30_000 }, async () => {
    const { host, done } = await opened("pages");
    try {
      const scrubber = host.querySelector<HTMLInputElement>('[data-testid="scrubber"]')!;
      expect(Number.parseFloat(scrubber.style.height)).toBeGreaterThanOrEqual(24);
    } finally {
      await done();
    }
  });
});
