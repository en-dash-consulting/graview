// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { bindSchema, createSchema, defineApp, defineNode, Store, z } from "@graview/core";
import { EMPTY_VIEW } from "@graview/layout";
import { registerDefaultViews, Shell } from "@graview/primitives";
import { createViews, GraviewProvider } from "@graview/react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { mount, preload, type EmbedHandle, type EmbedOptions } from "../../src/index.js";

beforeAll(() => preload());
(Element.prototype as { scrollTo?: unknown }).scrollTo = () => {};

/**
 * THE APP AS IT WAS IS SHOWN ON BOTH FACES (Roadmap f-playback). From any
 * row of Activity, "Show the app as it was here" draws the app as it stood
 * just after that change — the scene's picture and the routed face's page
 * alike, from `store.at` — with a timeline: an "as of" banner, a tick per
 * change marked by who made it, play and its speed, and the way back to
 * now. Nothing is offered to change while the past is shown.
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

/** Three notes, each its own change. */
function written() {
  const store = new Store({ schema, mutations: [addNote], invariants: [], snapshot: { nodes: [], edges: [] } });
  for (const label of ["First", "Second", "Third"]) store.apply({ name: "add-note", args: { label } }, { author: me });
  return store;
}

async function settled(holds: () => void): Promise<void> {
  for (const end = Date.now() + 3000; ; ) {
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

/** What the routed face draws, without the bar and its Activity. */
const page = (host: Element) => host.querySelector("[data-embed-content]")?.textContent ?? "";
const click = (element: Element | null | undefined) => act(async () => (element as HTMLElement).click());

/** Open Activity and show the app as it was after its oldest change listed. */
async function lookBack(host: Element) {
  await settled(() => expect(host.querySelector('[data-testid="activity-button"]')).not.toBeNull());
  await click(host.querySelector('[data-testid="activity-button"]'));
  await settled(() => expect(document.querySelectorAll('[data-testid="show-past"]').length).toBe(3));
  // Newest first: the last row is the first note added.
  await click([...document.querySelectorAll('[data-testid="show-past"]')].at(-1));
  await settled(() => expect(host.querySelector('[data-testid="timeline"]')).not.toBeNull());
}

function timelineSays(host: Element) {
  const timeline = host.querySelector('[data-testid="timeline"]')!;
  return {
    asOf: timeline.querySelector('[data-testid="as-of"]')?.textContent ?? "",
    caption: timeline.querySelector('[data-testid="timeline-caption"]')?.textContent ?? "",
    ticks: [...timeline.querySelectorAll("[data-graview-tick]")].map((tick) => tick.getAttribute("data-maker")),
    scrubber: timeline.querySelector<HTMLInputElement>('[data-testid="scrubber"]')!,
  };
}

describe("the app as it was, on the scene", () => {
  it("is drawn from the moment chosen, with a tick per change, and comes back to now", async () => {
    const store = written();
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () =>
      root.render(
        <GraviewProvider store={store} principal={me} views={registerDefaultViews(schema, createViews(schema))} initialView={{ ...EMPTY_VIEW, overview: true }} brand={{ name: "Field notes" } as never}>
          <Shell<typeof schema> scheme="light" onScheme={() => {}} />
        </GraviewProvider>,
      ),
    );
    try {
      await lookBack(host);
      const said = timelineSays(host);
      expect(said.asOf).toMatch(/^As of /);
      expect(said.caption).toBe("You: Add “First”");
      expect(said.ticks).toEqual(["you", "you", "you"]);
      expect(said.scrubber.value).toBe("1");
      // Nothing to change in the past: no undo, no ask field.
      expect(document.querySelector('[data-testid="undo-turn"]')).toBeNull();
      expect(host.querySelector('[data-testid="past-read-only"]')).not.toBeNull();
      await click(host.querySelector('[data-testid="back-to-now"]'));
      await settled(() => expect(host.querySelector('[data-testid="timeline"]')).toBeNull());
    } finally {
      await act(async () => root.unmount());
      host.remove();
    }
  });
});

describe("the app as it was, on the routed face", () => {
  it("re-draws the page at the moment with its banner, and offers no act there", { timeout: 30_000 }, async () => {
    const store = written();
    const host = document.createElement("div");
    document.body.appendChild(host);
    let handle: EmbedHandle | undefined;
    await act(async () => {
      handle = mount(host, { app, fonts: false, face: "pages", path: "/notes", store, principal: me } as unknown as EmbedOptions);
    });
    try {
      await settled(() => expect(host.textContent).toContain("Third"));
      const offered = () => [...host.querySelectorAll("button, a")].filter((one) => /Add a note/.test(one.textContent ?? "")).length;
      await settled(() => expect(offered()).toBeGreaterThan(0));
      await lookBack(host);
      await settled(() => expect(page(host)).not.toContain("Third"));
      expect(page(host)).toContain("First");
      expect(timelineSays(host).asOf).toMatch(/^As of /);
      expect(offered()).toBe(0);
      // Scrubbed on to the next change, the page draws that moment.
      await act(async () => {
        const scrubber = timelineSays(host).scrubber;
        const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
        set.call(scrubber, "2");
        scrubber.dispatchEvent(new Event("input", { bubbles: true }));
      });
      await settled(() => expect(page(host)).toContain("Second"));
      expect(page(host)).not.toContain("Third");
      await click(host.querySelector('[data-testid="back-to-now"]'));
      await settled(() => expect(host.textContent).toContain("Third"));
      expect(offered()).toBeGreaterThan(0);
    } finally {
      await act(async () => handle!.unmount());
      host.remove();
      sessionStorage.clear();
    }
  });
});
