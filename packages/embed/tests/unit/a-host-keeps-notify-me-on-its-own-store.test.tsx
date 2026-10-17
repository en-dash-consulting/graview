// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { bindSchema, createSchema, defineApp, defineNode, memorySubscriptions, Store, z, type SubscriptionStore } from "@graview/core";
import { askToNotify } from "@graview/primitives";
import { act } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { mount, preload, type EmbedHandle, type EmbedOptions } from "../../src/index.js";

beforeAll(() => preload());
(Element.prototype as { scrollTo?: unknown }).scrollTo = () => {};
// jsdom draws a <dialog> but cannot show one modally: open is all the sheet needs here.
const dialog = HTMLDialogElement.prototype as { showModal?: () => void; close?: () => void };
dialog.showModal ??= function (this: HTMLDialogElement) {
  this.setAttribute("open", "");
};

/**
 * A HOST KEEPS "NOTIFY ME" ON ITS OWN STORE (FR-182). `mount`'s
 * `subscriptions` is the store the sheet "Notify me…" adds to and
 * Activity's list reads, on the scene and on the pages alike — a hosted
 * page hands `remoteSubscriptions`, so what a reader asks to be told of is
 * kept by the host, not in the page's memory.
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
  store.apply({ name: "add-note", args: { label: "First" } }, { author: me });
  return store;
}

/** The host's store: kept in memory here, its `add` watched. */
function handed(): SubscriptionStore & { add: ReturnType<typeof vi.fn> } {
  const kept = memorySubscriptions();
  return { ...kept, add: vi.fn((draft: Parameters<SubscriptionStore["add"]>[0]) => kept.add(draft)) };
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

const opened: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const done of opened.splice(0)) await done();
});

async function open(options: Partial<EmbedOptions>): Promise<HTMLElement> {
  const host = document.createElement("div");
  document.body.appendChild(host);
  let handle: EmbedHandle | undefined;
  await act(async () => {
    handle = mount(host, { app, fonts: false, store: written(), principal: me, ...options } as unknown as EmbedOptions);
  });
  opened.push(async () => {
    await act(async () => handle!.unmount());
    host.remove();
  });
  return host;
}

/** Keep what the sheet offers first. */
async function keep() {
  await settled(() => expect(document.querySelector('[data-testid="notify-sheet"]')).not.toBeNull());
  const form = document.querySelector('[data-testid="notify-sheet"] form')!;
  await act(async () => void form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
}

describe("a host's subscriptions handed to mount", () => {
  it("are what the record page's Notify me keeps to, on the pages face", async () => {
    const subscriptions = handed();
    const host = await open({ face: "pages", path: "/notes/note-First", subscriptions });
    await settled(() => expect(host.querySelector('[data-testid="record-notify"]')).not.toBeNull());
    await act(async () => (host.querySelector('[data-testid="record-notify"]') as HTMLElement).click());
    await keep();
    await settled(() => expect(subscriptions.add).toHaveBeenCalledTimes(1));
    expect(subscriptions.add.mock.calls[0]![0]).toMatchObject({ who: { id: "me" }, when: { on: "changed", record: "note-First" } });
  });

  it("are what the sheet keeps to on the scene: the sheet opens for that store and adds to it", async () => {
    const subscriptions = handed();
    await open({ face: "graview", subscriptions });
    // The sheet is asked of a store; only a face whose provider keeps to the handed one draws it.
    await settled(() => expect(document.querySelector("[data-graview-scene], [data-embed-content], main")).not.toBeNull());
    await act(async () => askToNotify(subscriptions, { choices: [{ on: "changed", record: "note-First" }] }));
    await keep();
    await settled(() => expect(subscriptions.add).toHaveBeenCalledTimes(1));
    expect(subscriptions.add.mock.calls[0]![0]).toMatchObject({ who: { id: "me" }, when: { on: "changed", record: "note-First" } });
  });
});
