// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { bindSchema, createSchema, defineApp, defineNode, Store, z } from "@graview/core";
import type { AwaySummary } from "@graview/react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { Embed, mount, preload, type EmbedOptions } from "../../src/index.js";
import { mount as mountPages, type PagesEmbedOptions } from "../../src/pages.js";

/**
 * WHAT WAS DONE WHILE AWAY MAY COME AFTER THE FIRST DRAW (FR-212). A host
 * works out `whileAway` from the store it opens, so it learns it after the
 * page has drawn; the option was read once, at `mount`, so the host had to
 * hold the whole page back to say one line on the tray. `handle.setWhileAway`
 * hands it over afterwards — on the embed and on the pages alone — and a
 * React host's changed `whileAway` prop does the same: the Suggested tray
 * says it from then on, and nothing again once it is taken away.
 */
(Element.prototype as { scrollTo?: unknown }).scrollTo ??= () => {};

const task = defineNode("task", { fields: z.object({ label: z.string() }), plural: "Tasks" });
const schema = createSchema([task]);
const { defineMutation } = bindSchema(schema);
const addTask = defineMutation("add-task", {
  title: "Add a task",
  creates: ["task"],
  input: z.object({ label: z.string().min(1) }),
  describe: (args) => `Add “${args.label}”`,
  apply(ctx, args) {
    ctx.addNode({ id: `task-${args.label}`, kind: "task", label: args.label } as never);
  },
});
const app = defineApp({ name: "Errands", schema, mutations: [addTask] });
/** A store the app's own actor has been at: something was done in it, so a face has Activity to draw beside the tray. */
function tidiedStore() {
  const store = new Store({ schema, mutations: [addTask], invariants: [], snapshot: { nodes: [], edges: [] } });
  store.apply({ name: "add-task", args: { label: "Buy stamps" } }, { author: { kind: "system", id: "tidying", name: "Graview, tidying", automated: true } });
  return store;
}

beforeAll(() => preload("pages"), 60_000);

let unmount: (() => void) | undefined;
let host: HTMLElement | undefined;
afterEach(async () => {
  await act(async () => unmount?.());
  host?.remove();
  unmount = undefined;
  host = undefined;
});

const wait = (ms: number) =>
  act(async () => {
    await vi.dynamicImportSettled();
    await new Promise((resolve) => setTimeout(resolve, ms));
  });
async function until(check: () => boolean, ms = 4000): Promise<boolean> {
  for (let spent = 0; spent < ms; spent += 25) {
    if (check()) return true;
    await wait(25);
  }
  return check();
}
const tray = () => host!.querySelector<HTMLElement>('[data-testid="suggested-button"]');
const appBar = () => host!.querySelector("[data-graview-app-bar]");

type Handle = { setWhileAway(away: AwaySummary | undefined): void; unmount(): void };
const faces: [string, (element: HTMLElement) => Handle][] = [
  ["the whole embed", (element) => mount(element, { app, store: tidiedStore() as never, fonts: false, studio: false, face: "pages" } as EmbedOptions)],
  ["the pages alone", (element) => mountPages(element, { app, store: tidiedStore() as never, fonts: false } as PagesEmbedOptions)],
];

describe.each(faces)("on %s", (_name, mountOne) => {
  it("the tray says what the handle hands it after the first draw, and nothing once it is taken away", async () => {
    host = document.createElement("div");
    document.body.appendChild(host);
    let handle!: Handle;
    await act(async () => {
      handle = mountOne(host!);
    });
    unmount = () => handle.unmount();
    expect(await until(() => appBar() !== null)).toBe(true);
    expect(tray()).toBeNull();
    await act(async () => handle.setWhileAway({ tidied: 3, waiting: 0 }));
    expect(await until(() => tray() !== null)).toBe(true);
    expect(tray()!.getAttribute("aria-label")).toBe("Suggested: Tidied 3 things while you were away");
    await act(async () => handle.setWhileAway(undefined));
    expect(await until(() => tray() === null)).toBe(true);
  });
});

describe("a React host", () => {
  it("hands a changed whileAway prop to the tray without a remount", async () => {
    host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    unmount = () => root.unmount();
    const props = { app, store: tidiedStore() as never, fonts: false, studio: false, face: "pages" } as EmbedOptions;
    await act(async () => root.render(<Embed {...props} />));
    expect(await until(() => appBar() !== null)).toBe(true);
    expect(tray()).toBeNull();
    await act(async () => root.render(<Embed {...props} whileAway={{ tidied: 12, waiting: 0 }} />));
    expect(await until(() => tray() !== null)).toBe(true);
    expect(tray()!.getAttribute("aria-label")).toBe("Suggested: Tidied 12 things while you were away");
  });
});
