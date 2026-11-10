// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { bindSchema, createSchema, defineApp, defineNode, Store, z } from "@graview/core";
import { act } from "react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { mount, preload, type EmbedHandle, type EmbedOptions } from "../../src/index.js";
import { mount as mountPages, type PagesEmbedHandle, type PagesEmbedOptions } from "../../src/pages.js";

beforeAll(() => preload());
(Element.prototype as { scrollTo?: unknown }).scrollTo = () => {};

/**
 * THE HISTORY OPENS FROM THE INBOX AND FROM THE HOST'S MENU (Roadmap
 * f-host-opens-history). People could not find an app's previous versions:
 * they were a row of Activity away. The inbox now has one plain row,
 * "History", that opens the timeline at now; and a host opens the same
 * timeline from its own menu with `handle.showHistory()`, on either face
 * and on the pages alone, even before the face has drawn.
 */
const note = defineNode("note", { fields: z.object({ label: z.string() }), plural: "Notes" });
const schema = createSchema([note]);
const { defineMutation } = bindSchema(schema);
const addNote = defineMutation("add-note", {
  title: "Add a note",
  description: "Bring a note in.",
  creates: ["note"],
  input: z.object({ label: z.string().min(1) }),
  describe: (args) => `Add “${args.label}”`,
  apply(ctx, args) {
    ctx.addNode({ id: `note-${args.label}`, kind: "note", label: args.label } as never);
  },
});
const app = defineApp({ name: "Field notes", schema, mutations: [addNote] });
const me = { kind: "human" as const, id: "me" };

function written() {
  const store = new Store({ schema, mutations: [addNote], invariants: [], snapshot: { nodes: [], edges: [] } });
  for (const label of ["First", "Second", "Third"]) store.apply({ name: "add-note", args: { label } }, { author: me });
  return store;
}

async function settled(holds: () => void): Promise<void> {
  for (const end = Date.now() + 5000; ; ) {
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

/** The timeline open at now: three ticks, the scrubber at its end, "Now" said. */
function atNow(host: Element) {
  const shown = timeline(host)!;
  expect(shown).not.toBeNull();
  expect(shown.getAttribute("data-graview-past")).toBe("now");
  expect(shown.querySelector('[data-testid="as-of"]')?.textContent).toBe("Now");
  expect(shown.querySelectorAll("[data-graview-tick]").length).toBe(3);
  const scrubber = shown.querySelector<HTMLInputElement>('[data-testid="scrubber"]')!;
  expect(scrubber.value).toBe(scrubber.max);
}

function placed() {
  const host = document.createElement("div");
  document.body.appendChild(host);
  return host;
}

describe("History in the inbox", () => {
  it("is a row named plainly that opens the timeline at now, and the keyboard goes on to its scrubber", { timeout: 30_000 }, async () => {
    const host = placed();
    let handle: EmbedHandle | undefined;
    await act(async () => {
      handle = mount(host, { app, fonts: false, face: "pages", path: "/notes", store: written(), principal: me } as unknown as EmbedOptions);
    });
    try {
      await settled(() => expect(host.querySelector('[data-testid="inbox-button"]')).not.toBeNull());
      await click(host.querySelector('[data-testid="inbox-button"]'));
      await settled(() => expect(document.querySelector('[data-testid="inbox-history"]')).not.toBeNull());
      const entry = document.querySelector<HTMLButtonElement>('[data-testid="inbox-history"]')!;
      // Its name is the one word; what it holds is its description.
      expect(entry.tagName).toBe("BUTTON");
      expect([...entry.childNodes].filter((one) => !(one as Element).getAttribute?.("aria-hidden")).map((one) => one.textContent).join("").trim()).toBe("History");
      expect(document.getElementById(entry.getAttribute("aria-describedby")!)?.textContent).toMatch(/Every change/);
      // Under every tab of the inbox, not one alone.
      expect(entry.closest('[role="tabpanel"]')).toBeNull();
      await click(entry);
      await settled(() => atNow(host));
      expect(document.querySelector('[data-testid="inbox"]')).toBeNull();
      await settled(() => expect(document.activeElement?.getAttribute("data-testid")).toBe("scrubber"));
      await click(host.querySelector('[data-testid="back-to-now"]'));
      await settled(() => expect(timeline(host)).toBeNull());
    } finally {
      await act(async () => handle!.unmount());
      host.remove();
      sessionStorage.clear();
    }
  });
});

describe("showHistory() on the mount handle", () => {
  it("opens the same timeline on the routed face", { timeout: 30_000 }, async () => {
    const host = placed();
    let handle: EmbedHandle | undefined;
    await act(async () => {
      handle = mount(host, { app, fonts: false, face: "pages", path: "/notes", store: written(), principal: me } as unknown as EmbedOptions);
    });
    try {
      await settled(() => expect(host.textContent).toContain("Third"));
      expect(timeline(host)).toBeNull();
      await act(async () => handle!.showHistory());
      await settled(() => atNow(host));
    } finally {
      await act(async () => handle!.unmount());
      host.remove();
      sessionStorage.clear();
    }
  });

  it("opens it on the scene, asked before the face has drawn", { timeout: 30_000 }, async () => {
    const host = placed();
    let handle: EmbedHandle | undefined;
    await act(async () => {
      handle = mount(host, { app, fonts: false, face: "scene", store: written(), principal: me } as unknown as EmbedOptions);
      handle.showHistory();
    });
    try {
      await settled(() => atNow(host));
    } finally {
      await act(async () => handle!.unmount());
      host.remove();
      sessionStorage.clear();
    }
  });

  it("opens it on the pages alone", { timeout: 30_000 }, async () => {
    const host = placed();
    let handle: PagesEmbedHandle | undefined;
    await act(async () => {
      handle = mountPages(host, { app, fonts: false, path: "/notes", store: written(), principal: me } as unknown as PagesEmbedOptions);
    });
    try {
      await settled(() => expect(host.textContent).toContain("Third"));
      await act(async () => handle!.showHistory());
      await settled(() => atNow(host));
    } finally {
      await act(async () => handle!.unmount());
      host.remove();
      sessionStorage.clear();
    }
  });
});
