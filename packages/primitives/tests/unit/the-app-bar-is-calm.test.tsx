// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import axe from "axe-core";
import { bindSchema, createSchema, defineNode, nodeRef, Store, type Author, type Principal } from "@graview/core";
import { suggest } from "@graview/core/tidying";
import { createViews, GraviewProvider, type HostNotification } from "@graview/react";
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { AppBar, Inbox, inboxWords, type AppMenuRow, type BarAction, type BarFaces, type BarShare } from "../../src/index.js";

/**
 * THE APP BAR, CALMER (Roadmap f-app-bar-calm). Homeflow's bar held ten
 * things in seven shapes. The app's name opens an app menu that holds the
 * scene and the pages, a host's rows and the scheme; one inbox — a bell,
 * one count, three tabs — takes the place of Suggested and Activity; a
 * host's Share says who can open the app in a sentence; a host's button may
 * be its mark alone, named by its label. `pnpm verify chrome` measures the
 * same in a real browser at every width.
 */
let host: HTMLDivElement | undefined;
let root: Root | undefined;
const realRect = Element.prototype.getBoundingClientRect;
(Element.prototype as { scrollTo?: unknown }).scrollTo = () => {};
afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  host = undefined;
  root = undefined;
  Element.prototype.getBoundingClientRect = realRect;
  vi.restoreAllMocks();
});

/** The bar as wide as a desk, or as a phone: jsdom lays nothing out, so the bar's box is said for it. */
function barAs(width: number) {
  Element.prototype.getBoundingClientRect = function (this: Element) {
    const wide = this.classList.contains("graview-bar") ? width : 0;
    return { x: 0, y: 0, left: 0, top: 0, right: wide, bottom: 0, width: wide, height: 0, toJSON: () => ({}) } as DOMRect;
  };
}

function draw(node: ReactNode): HTMLDivElement {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  act(() => root!.render(node));
  return host;
}

async function settled(holds: () => void): Promise<void> {
  for (const end = Date.now() + 4000; ; ) {
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

const $ = (selector: string) => document.querySelector<HTMLElement>(selector);

const went: string[] = [];
const faces: BarFaces = {
  scene: { label: "Scene", current: false, go: () => went.push("scene") },
  pages: { label: "Pages", current: true, go: () => went.push("pages") },
};

function bar(props: { readonly appMenu?: readonly AppMenuRow[]; readonly share?: BarShare; readonly actions?: readonly BarAction[]; readonly scheme?: Parameters<typeof AppBar>[0]["scheme"]; readonly faces?: BarFaces }) {
  return draw(<AppBar brand={undefined} name="Homeflow" home={{ href: "/", current: true }} places={[]} current={null} reach={{}} find={false} tools={null} {...props} />);
}

describe("the app menu (Roadmap f-app-bar-calm)", () => {
  it("stands beside the app's name, which stays the way home, and holds the scene and the pages, a host's rows and the scheme", async () => {
    barAs(1440);
    const settings = vi.fn();
    const chose: string[] = [];
    const at = bar({ faces, appMenu: [{ label: "App settings", onSelect: settings }, { label: "Connections", href: "/connections" }], scheme: { value: "system", onChoose: (value) => chose.push(value) } });
    // No pill of two on the row: the switch is the menu's.
    expect(at.querySelector('[data-testid="app-faces"]')).toBeNull();
    const open = at.querySelector<HTMLButtonElement>('[data-testid="app-menu-open"]')!;
    expect(open.getAttribute("aria-label")).toBe("Homeflow — app menu");
    expect(at.querySelector('[data-testid="app-home"]')!.compareDocumentPosition(open) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    act(() => open.click());
    await settled(() => expect($('[data-testid="app-menu"] [data-testid="app-face-scene"]')).not.toBeNull());
    const menu = $('[data-testid="app-menu"]')!;
    expect(menu.hidden).toBe(false);
    expect([...menu.querySelectorAll('[data-testid^="app-face-"]')].map((one) => [one.textContent, one.getAttribute("aria-pressed")])).toEqual([
      ["Scene", "false"],
      ["Pages", "true"],
    ]);
    expect([...menu.querySelectorAll('[data-testid="app-menu-row"]')].map((one) => [one.tagName, one.textContent])).toEqual([
      ["BUTTON", "App settings"],
      ["A", "Connections"],
    ]);
    expect([...menu.querySelectorAll('[data-testid^="app-menu-scheme-"]')].map((one) => [one.textContent, one.getAttribute("aria-pressed")])).toEqual([
      ["System", "true"],
      ["Light", "false"],
      ["Dark", "false"],
    ]);
    act(() => $('[data-testid="app-menu-scheme-dark"]')!.click());
    expect(chose).toEqual(["dark"]);
    const result = await axe.run(menu, { rules: { region: { enabled: false } } });
    expect(result.violations.map((violation) => violation.id)).toEqual([]);
    // A host's row is pressed and the menu goes away; the scene is one press from it.
    act(() => $('[data-testid="app-menu-row"]')!.click());
    expect(settings).toHaveBeenCalledTimes(1);
    expect($('[data-testid="app-menu"]')!.hidden).toBe(true);
    act(() => open.click());
    await settled(() => expect($('[data-testid="app-face-scene"]')).not.toBeNull());
    act(() => $('[data-testid="app-face-scene"]')!.click());
    expect(went).toContain("scene");
  });

  it("is not drawn where it would hold nothing", () => {
    barAs(1440);
    const at = bar({});
    expect(at.querySelector('[data-testid="app-menu-open"]')).toBeNull();
  });
});

describe("a host's Share, beside the people (Roadmap f-app-bar-calm, f-bar-status-item)", () => {
  it("is a button named by its word, its sentence its description and hover, and a press says the sentence with the way to change it", async () => {
    barAs(1440);
    const at = bar({ share: { mark: "lock", description: "Only people in the Okafor household can open this app.", link: { label: "People & sharing", href: "/sharing" } } });
    const button = at.querySelector<HTMLButtonElement>('[data-testid="app-share-open"]')!;
    expect(button.textContent).toBe("Share");
    expect(button.getAttribute("title")).toBe("Only people in the Okafor household can open this app.");
    expect(document.getElementById(button.getAttribute("aria-describedby")!)?.textContent).toBe("Only people in the Okafor household can open this app.");
    // The mark is drawn, and hidden from a reader: the word says it.
    expect(button.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
    act(() => button.click());
    const pane = $('[data-testid="app-share"]')!;
    expect(pane.hidden).toBe(false);
    expect(pane.querySelector('[data-testid="app-share-said"]')?.textContent).toBe("Only people in the Okafor household can open this app.");
    expect(pane.querySelector('[data-testid="app-share-link"]')?.getAttribute("href")).toBe("/sharing");
    const result = await axe.run(at, { rules: { region: { enabled: false } } });
    expect(result.violations.map((violation) => violation.id)).toEqual([]);
  });
});

describe("a host's button as its mark alone (Roadmap f-app-bar-calm)", () => {
  it("is named by its label and says it on hover, with no words drawn, and stands on a phone's bar too", async () => {
    const feedback = vi.fn();
    for (const width of [1440, 390]) {
      barAs(width);
      const at = bar({ actions: [{ label: "Send feedback", icon: "💬", iconOnly: true, onSelect: feedback }] });
      const button = at.querySelector<HTMLButtonElement>('[data-testid="host-bar-action"]')!;
      expect(button, `${width}`).not.toBeNull();
      expect(button.hasAttribute("data-icon-only")).toBe(true);
      expect(button.getAttribute("title")).toBe("Send feedback");
      expect(button.querySelector(".graview-bar-host-words")?.textContent).toBe("Send feedback");
      expect(at.querySelector('[data-testid="host-bar-actions-open"]')).toBeNull();
      const result = await axe.run(button, { rules: { region: { enabled: false } } });
      expect(result.violations.map((violation) => violation.id)).toEqual([]);
      act(() => root?.unmount());
      host?.remove();
    }
    // The words are hidden by the bar's own rule, never by a host's stylesheet.
    barAs(1440);
    const at = bar({ actions: [{ label: "Send feedback", icon: "💬", iconOnly: true, onSelect: feedback }] });
    expect(at.querySelector("style")?.textContent).toContain(".graview-bar-host-action[data-icon-only]>.graview-bar-host-words{position:absolute;width:1px");
  });
});

const task = defineNode("task", { fields: z.object({ label: z.string() }), plural: "Tasks", label: (node) => node.label, edges: { "waits-for": { to: ["task"], description: "what has to happen first" } } });
const schema = createSchema([task]);
const { defineMutation } = bindSchema(schema);
const waitFor = defineMutation("wait-for", {
  title: "This has to happen first",
  subject: { kinds: ["task"], arg: "taskId" },
  connects: ["waits-for"],
  input: z.object({ taskId: nodeRef(["task"]), blockerId: nodeRef(["task"]) }),
  describe: () => "Waits",
  apply(ctx, args) {
    ctx.addEdge({ kind: "waits-for", from: args.taskId, to: args.blockerId });
  },
});
const rename = defineMutation("rename", {
  title: "Rename",
  subject: { kinds: ["task"], arg: "id" },
  writes: ["label"],
  input: z.object({ id: nodeRef(["task"]), label: z.string().min(1) }),
  describe: (args) => `Rename to "${args.label}"`,
  apply(ctx, args) {
    ctx.patchNode(args.id, { label: args.label });
  },
});
const nora: Principal = { kind: "human", id: "nora", name: "Nora" };
const actor: Author = { kind: "system", id: "tidying", name: "Graview, tidying", automated: true };

function storeWith(): Store<typeof schema> {
  return new Store({ schema, mutations: [waitFor, rename], snapshot: { nodes: [{ id: "task:a", kind: "task", label: "Paint" }, { id: "task:b", kind: "task", label: "Shelves" }] as never, edges: [] } });
}

describe("one inbox (Roadmap f-app-bar-calm)", () => {
  it("is one bell with one count — what waits for you and what has happened — that opens three tabs, on what waits first", async () => {
    const store = storeWith();
    store.apply({ name: "rename", args: { id: "task:a", label: "Paint the hall" } }, { author: nora });
    suggest(store, [{ name: "wait-for", args: { taskId: "task:a", blockerId: "task:b" } }], { author: actor, lineage: { basis: "The shelves cover the wall", confidence: 0.6 } });
    const seen: string[][] = [];
    const notifications: readonly HostNotification[] = [
      { id: "n1", title: "Sam invited you to Homeflow" },
      { id: "n2", title: "Weekly digest", read: true },
    ];
    draw(
      <GraviewProvider store={store} views={createViews(schema)} principal={nora} notifications={notifications} onNotificationsSeen={(ids) => seen.push([...ids])}>
        <Inbox />
      </GraviewProvider>,
    );
    // One waiting suggestion, one unread notification, two changes (the rename and the suggestion's own row is not one).
    await settled(() => expect($('[data-testid="inbox-button"]')?.getAttribute("aria-label")).toMatch(/^Inbox — 2 waiting for you, \d changes?$/));
    const bell = $('[data-testid="inbox-button"]')!;
    expect($('[data-testid="inbox-count"]')!.textContent).toBe(bell.getAttribute("data-count"));
    expect(document.querySelectorAll('[data-testid="suggested-button"], [data-testid="activity-button"]')).toHaveLength(0);
    act(() => bell.click());
    await settled(() => expect($('[data-testid="inbox"] [data-testid="suggested"]')).not.toBeNull());
    const tabs = [...document.querySelectorAll('[data-testid="inbox"] [role="tab"]')];
    expect(tabs.map((tab) => tab.getAttribute("data-testid"))).toEqual(["inbox-tab-for-you", "inbox-tab-activity", "inbox-tab-asks"]);
    expect(tabs.map((tab) => tab.getAttribute("aria-selected"))).toEqual(["true", "false", "false"]);
    expect([...document.querySelectorAll('[data-testid="inbox-notification"]')].map((one) => [one.textContent, one.hasAttribute("data-unread")])).toEqual([
      ["Sam invited you to Homeflow, unread", true],
      ["Weekly digest", false],
    ]);
    // The host is told what it has now shown, once.
    expect(seen).toEqual([["n1"]]);
    // Activity is a press away, and holds what has happened.
    act(() => (tabs[1] as HTMLElement).click());
    await settled(() => expect($('[data-testid="inbox"] [data-testid="activity"] [data-testid="diff-log"]')).not.toBeNull());
    expect($('[data-testid="inbox-tab-activity"]')!.getAttribute("aria-selected")).toBe("true");
    // Your asks says what it keeps, where nothing was asked yet.
    act(() => $('[data-testid="inbox-tab-asks"]')!.click());
    expect($('[data-testid="inbox-panel-asks"] [data-testid="inbox-empty"]')?.textContent).toMatch(/What you ask the app is kept here/);
    const result = await axe.run($('[data-testid="inbox"]')!, { rules: { region: { enabled: false } } });
    expect(result.violations.map((violation) => violation.id)).toEqual([]);
  });

  it("is not drawn while it holds nothing", async () => {
    draw(
      <GraviewProvider store={storeWith()} views={createViews(schema)} principal={nora}>
        <Inbox />
      </GraviewProvider>,
    );
    await settled(() => expect($('[data-testid="inbox-button"]')).toBeNull());
  });

  it("says its count in words", () => {
    expect(inboxWords(0, 0)).toBe("Inbox");
    expect(inboxWords(3, 0)).toBe("Inbox — 3 waiting for you");
    expect(inboxWords(0, 1)).toBe("Inbox — 1 change");
    expect(inboxWords(25, 4)).toBe("Inbox — 25 waiting for you, 4 changes");
  });
});
