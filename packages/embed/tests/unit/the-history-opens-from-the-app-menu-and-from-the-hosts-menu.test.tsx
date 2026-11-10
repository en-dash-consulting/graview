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
 * THE HISTORY OPENS FROM THE APP MENU AND FROM THE HOST'S MENU (Roadmap
 * f-host-opens-history). People could not find an app's previous versions:
 * they were a row of Activity away. The app menu, beside the app's name,
 * now has one plain row, History, that opens the timeline at now; and a
 * host opens the same timeline from its own menu with
 * `handle.showHistory()` — on that mount alone, on either face and on the
 * pages alone, as the face arrives when asked before it has drawn, and
 * never once the mount is gone.
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

function written(labels: readonly string[] = ["First", "Second", "Third"]) {
  const store = new Store({ schema, mutations: [addNote], invariants: [], snapshot: { nodes: [], edges: [] } });
  for (const label of labels) store.apply({ name: "add-note", args: { label } }, { author: me });
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

/** Long enough for a face to have drawn and anything waiting on it to have opened. */
const awhile = async () => {
  for (let turn = 0; turn < 30; turn++)
    await act(async () => {
      await vi.dynamicImportSettled();
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
};

const click = (element: Element | null | undefined) => act(async () => (element as HTMLElement).click());
const timeline = (host: Element) => host.querySelector('[data-testid="timeline"]');

/** The timeline open at now: a tick per change, the scrubber at its end, "Now" said. */
function atNow(host: Element, changes = 3) {
  const shown = timeline(host)!;
  expect(shown).not.toBeNull();
  expect(shown.getAttribute("data-graview-past")).toBe("now");
  expect(shown.querySelector('[data-testid="as-of"]')?.textContent).toBe("Now");
  expect(shown.querySelectorAll("[data-graview-tick]").length).toBe(changes);
  const scrubber = shown.querySelector<HTMLInputElement>('[data-testid="scrubber"]')!;
  expect(scrubber.value).toBe(scrubber.max);
}

function placed() {
  const host = document.createElement("div");
  document.body.appendChild(host);
  return host;
}

const pagesAt = (store: Store<typeof schema>) => ({ app, fonts: false, face: "pages", path: "/notes", store, principal: me }) as unknown as EmbedOptions;

/** Open the app menu beside the app's name and wait for History in it. */
async function historyInTheMenu(host: Element): Promise<HTMLButtonElement> {
  await settled(() => expect(host.querySelector('[data-testid="app-menu-open"]')).not.toBeNull());
  await click(host.querySelector('[data-testid="app-menu-open"]'));
  await settled(() => expect(host.querySelector('[data-testid="app-menu"] [data-testid="app-menu-history"]')).not.toBeNull());
  return host.querySelector<HTMLButtonElement>('[data-testid="app-menu"] [data-testid="app-menu-history"]')!;
}

describe("History in the app menu", () => {
  it("is a row named plainly that opens the timeline at now, and the keyboard goes on to its scrubber", { timeout: 30_000 }, async () => {
    const host = placed();
    let handle: EmbedHandle | undefined;
    await act(async () => {
      handle = mount(host, pagesAt(written()));
    });
    try {
      const entry = await historyInTheMenu(host);
      expect(entry.tagName).toBe("BUTTON");
      expect(entry.textContent?.trim()).toBe("History");
      await click(entry);
      await settled(() => atNow(host));
      expect(host.querySelector('[data-testid="app-menu"]')?.hasAttribute("hidden")).toBe(true);
      await settled(() => expect(document.activeElement).toBe(host.querySelector('[data-testid="scrubber"]')));
      await click(host.querySelector('[data-testid="back-to-now"]'));
      await settled(() => expect(timeline(host)).toBeNull());
    } finally {
      await act(async () => handle!.unmount());
      host.remove();
      sessionStorage.clear();
    }
  });

  it("is there before anything has happened, and its timeline says there are no changes yet", { timeout: 30_000 }, async () => {
    const host = placed();
    let handle: EmbedHandle | undefined;
    await act(async () => {
      handle = mount(host, pagesAt(written([])));
    });
    try {
      await click(await historyInTheMenu(host));
      await settled(() => expect(timeline(host)?.querySelector('[data-testid="timeline-caption"]')?.textContent).toBe("No changes yet"));
    } finally {
      await act(async () => handle!.unmount());
      host.remove();
      sessionStorage.clear();
    }
  });

  it("gives the keyboard only to its own app's scrubber, and not once the person has gone on", { timeout: 30_000 }, async () => {
    const one = placed();
    const other = placed();
    let first: EmbedHandle | undefined;
    let second: EmbedHandle | undefined;
    await act(async () => {
      first = mount(one, pagesAt(written()));
      second = mount(other, pagesAt(written()));
    });
    try {
      // The other app's timeline is open first.
      await act(async () => void second!.showHistory());
      await settled(() => atNow(other));
      await click(await historyInTheMenu(one));
      await settled(() => atNow(one));
      await settled(() => expect(document.activeElement).toBe(one.querySelector('[data-testid="scrubber"]')));
      await click(one.querySelector('[data-testid="back-to-now"]'));
      await settled(() => expect(timeline(one)).toBeNull());
      // Pressed, then the person goes on before the timeline is drawn: the keyboard stays where they took it.
      const elsewhere = document.createElement("button");
      document.body.appendChild(elsewhere);
      const entry = await historyInTheMenu(one);
      await act(async () => {
        entry.click();
        elsewhere.focus();
      });
      await settled(() => atNow(one));
      await awhile();
      expect(document.activeElement).toBe(elsewhere);
      elsewhere.remove();
    } finally {
      await act(async () => {
        first!.unmount();
        second!.unmount();
      });
      one.remove();
      other.remove();
      sessionStorage.clear();
    }
  });
});

describe("showHistory() on the mount handle", () => {
  it("opens the same timeline on the routed face, and says it was heard", { timeout: 30_000 }, async () => {
    const host = placed();
    let handle: EmbedHandle | undefined;
    await act(async () => {
      handle = mount(host, pagesAt(written()));
    });
    try {
      await settled(() => expect(host.textContent).toContain("Third"));
      expect(timeline(host)).toBeNull();
      let heard: boolean | undefined;
      await act(async () => {
        heard = handle!.showHistory();
      });
      expect(heard).toBe(true);
      await settled(() => atNow(host));
    } finally {
      await act(async () => handle!.unmount());
      host.remove();
      sessionStorage.clear();
    }
  });

  it("opens it on the scene, asked as it is mounted", { timeout: 30_000 }, async () => {
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
      await act(async () => void handle!.showHistory());
      await settled(() => atNow(host));
    } finally {
      await act(async () => handle!.unmount());
      host.remove();
      sessionStorage.clear();
    }
  });

  it("opens nothing once its mount is gone, not on the mount over the same store and element that took its place", { timeout: 30_000 }, async () => {
    const store = written();
    const host = placed();
    let gone: EmbedHandle | undefined;
    await act(async () => {
      gone = mount(host, pagesAt(store));
    });
    await settled(() => expect(host.textContent).toContain("Third"));
    await act(async () => gone!.unmount());
    let again: EmbedHandle | undefined;
    await act(async () => {
      again = mount(host, pagesAt(store));
    });
    try {
      await settled(() => expect(host.textContent).toContain("Third"));
      let heard: boolean | undefined;
      await act(async () => {
        heard = gone!.showHistory();
      });
      expect(heard).toBe(false);
      await awhile();
      expect(timeline(host)).toBeNull();
      // The mount that is here still opens its own.
      await act(async () => void again!.showHistory());
      await settled(() => atNow(host));
    } finally {
      await act(async () => again!.unmount());
      host.remove();
      sessionStorage.clear();
    }
  });

  it("says a picture draws no timeline, and opens none when the host goes on to another face", { timeout: 30_000 }, async () => {
    const host = placed();
    let handle: EmbedHandle | undefined;
    await act(async () => {
      handle = mount(host, { app, fonts: false, face: "picture", store: written(), principal: me } as unknown as EmbedOptions);
    });
    try {
      await act(async () => handle!.drawn());
      await awhile();
      let heard: boolean | undefined;
      await act(async () => {
        heard = handle!.showHistory();
      });
      expect(heard).toBe(false);
      await awhile();
      expect(timeline(host)).toBeNull();
      await act(async () => handle!.setFace("pages"));
      await settled(() => expect(host.textContent).toContain("Third"));
      await awhile();
      expect(timeline(host)).toBeNull();
    } finally {
      await act(async () => handle!.unmount());
      host.remove();
      sessionStorage.clear();
    }
  });

  it("opens only the mount it is asked of, where two draw one store", { timeout: 30_000 }, async () => {
    const store = written();
    const asked = placed();
    const beside = placed();
    let one: EmbedHandle | undefined;
    let two: EmbedHandle | undefined;
    await act(async () => {
      one = mount(asked, pagesAt(store));
      two = mount(beside, pagesAt(store));
    });
    try {
      await settled(() => {
        expect(asked.textContent).toContain("Third");
        expect(beside.textContent).toContain("Third");
      });
      await act(async () => void one!.showHistory());
      await settled(() => atNow(asked));
      await awhile();
      expect(timeline(beside)).toBeNull();
    } finally {
      await act(async () => {
        one!.unmount();
        two!.unmount();
      });
      asked.remove();
      beside.remove();
      sessionStorage.clear();
    }
  });
});

describe("History under a host's own bar", () => {
  it("is not offered where the host's bar says the app's name, nor where the host says no History, and the host's showHistory() still opens it", { timeout: 30_000 }, async () => {
    for (const bar of [{ faces: false, name: false }, { history: false }] as const) {
      const host = placed();
      let handle: EmbedHandle | undefined;
      await act(async () => {
        handle = mount(host, { ...pagesAt(written()), bar } as unknown as EmbedOptions);
      });
      try {
        await settled(() => expect(host.textContent).toContain("Third"));
        await awhile();
        if ("name" in bar) expect(host.querySelector('[data-testid="app-menu-open"]'), "no nameless chevron for History alone").toBeNull();
        else {
          await click(host.querySelector('[data-testid="app-menu-open"]'));
          await awhile();
          expect(host.querySelector('[data-testid="app-menu"] [data-testid="app-face-pages"]')).not.toBeNull();
          expect(host.querySelector('[data-testid="app-menu-history"]')).toBeNull();
        }
        await act(async () => void handle!.showHistory());
        await settled(() => atNow(host));
        // The host's own menu pressed, and put away: the keyboard goes on to the scrubber.
        await settled(() => expect(document.activeElement).toBe(host.querySelector('[data-testid="scrubber"]')));
      } finally {
        await act(async () => handle!.unmount());
        host.remove();
        sessionStorage.clear();
      }
    }
  });
});
