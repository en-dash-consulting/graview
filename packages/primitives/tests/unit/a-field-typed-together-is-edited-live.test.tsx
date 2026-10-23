// @vitest-environment jsdom
/* React's act() wants to know it is in a test environment. */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { bindSchema, createSchema, defineNode, markCollaborative, nodeRef, Store, TYPE_TEXT, type Presence, type PresenceCaret, type Principal } from "@graview/core";
import { diffSplice, transformSplices } from "@graview/core/typing";
import { GraviewProvider, createViews } from "@graview/react";
import { TypingContext, type FieldTyping, type LiveTyping } from "@graview/react/provider";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { Fields } from "../../src/index.js";
import { caretHere, carriedOver, carrySelection, diffText, inputSplice } from "../../src/live-text.js";

/**
 * A FIELD TYPED TOGETHER IS EDITED LIVE (Roadmap f-collab-text, phase 4).
 * Under a host that carries typing, prose the declaration types together
 * opens with no draft and no Save: each keystroke is a splice sent as it is
 * typed, a word being composed is sent once it is chosen, somebody else's
 * typing lands with the person's caret kept on its word, Escape closes
 * without putting anything back, Ctrl or ⌘ Z takes back this person's own
 * run and nobody else's, and others' carets are drawn where they stand.
 */

const essay = defineNode("essay", {
  fields: z.object({
    name: z.string(),
    body: z.string().max(20_000).optional(),
    notes: markCollaborative(z.string().max(20_000), false).optional(),
  }),
  plural: "Essays",
});
const schema = createSchema([essay]);
const { defineMutation } = bindSchema(schema);
const edit = defineMutation("edit-essay", {
  title: "Change the essay",
  subject: { kinds: ["essay"], arg: "id" },
  writes: ["body", "notes"],
  input: z.object({ id: nodeRef(["essay"]), body: z.string().max(20_000).optional(), notes: z.string().max(20_000).optional() }),
  apply(ctx, args) {
    const { id, ...rest } = args;
    ctx.patchNode(id, rest);
  },
});

const ADA: Principal = { kind: "human", id: "ada", name: "Ada" };
const BOB: Principal = { kind: "human", id: "bob", name: "Bob" };

const storeWith = (body: string) =>
  new Store({ schema, mutations: [edit], invariants: [], snapshot: { nodes: [{ id: "e", kind: "essay", name: "On foxes", body, notes: "Kept whole" }] as never, edges: [] } });

/** Typing as a served store does it, without the wire: each keystroke a `type-text` of its own, as Ada. */
function typingInto(store: Store<typeof schema>) {
  const sent: [number, number, string][] = [];
  const typing: FieldTyping = {
    splice(at, remove, insert) {
      sent.push([at, remove, insert]);
      store.apply({ name: TYPE_TEXT, args: { node: "e", field: "body", at, remove, insert } }, { author: ADA });
    },
    flush() {},
    waiting: () => 0,
  };
  return { typing, sent };
}

/** Bob types somewhere else, as the server would land it. */
const bobTypes = (store: Store<typeof schema>, at: number, remove: number, insert: string) =>
  act(async () => void store.apply({ name: TYPE_TEXT, args: { node: "e", field: "body", at, remove, insert } }, { author: BOB }));

const setValue = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!;

let root: Root | undefined;
let host: HTMLElement | undefined;
afterEach(async () => {
  if (root) await act(async () => root!.unmount());
  host?.remove();
  root = undefined;
});

async function open(store: Store<typeof schema>, live: LiveTyping, field = "body"): Promise<HTMLTextAreaElement> {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root!.render(
      <GraviewProvider store={store} views={createViews(schema)} principal={ADA}>
        <TypingContext.Provider value={live}>
          <Fields id="e" />
        </TypingContext.Provider>
      </GraviewProvider>,
    );
  });
  await act(async () => host!.querySelector<HTMLButtonElement>(`[data-graview-long="${field}"] dt button`)!.click());
  for (let tries = 0; tries < 100; tries++) {
    const area = host.querySelector<HTMLTextAreaElement>(`textarea[data-graview-field="${field}"]`);
    if (area && (!area.readOnly || field !== "body")) return area;
    await act(async () => new Promise((resolve) => setTimeout(resolve, 10)));
  }
  throw new Error("the text area never opened");
}

const liveFor = (typing: FieldTyping, who: ReadonlyMap<string, Presence> = new Map(), said: (PresenceCaret | null)[] = []): LiveTyping => ({
  typing: async () => typing,
  sayCaret: (caret) => void said.push(caret),
  who,
});

/** A keystroke as a browser makes it: the area's text changed, the caret after it, an `input`. */
async function type(area: HTMLTextAreaElement, next: string, caret: number) {
  await act(async () => {
    setValue.call(area, next);
    area.setSelectionRange(caret, caret);
    area.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

describe("what a keystroke was", () => {
  it("is put where the caret says it was typed, even in a run of the same letter", () => {
    expect(inputSplice("aa", "aaa", 1)).toEqual({ at: 0, removed: "", inserted: "a" });
    expect(inputSplice("aa", "aaa", 2)).toEqual({ at: 1, removed: "", inserted: "a" });
    expect(inputSplice("abc", "ac", 1)).toEqual({ at: 1, removed: "b", inserted: "" });
    expect(inputSplice("a😀b", "ab", 1)).toEqual({ at: 1, removed: "😀", inserted: "" });
  });

  it("is carried over somebody else's text as the store's own transform carries it, read without fetching the transform", () => {
    const base = "The quick brown fox jumps";
    const theirs = [
      { at: 4, removed: "", inserted: "very " },
      { at: 4, removed: "quick ", inserted: "" },
      { at: 10, removed: "brown", inserted: "red" },
      { at: 25, removed: "", inserted: "!" },
    ];
    const mine = [
      { at: 10, removed: "", inserted: "big " },
      { at: 4, removed: "", inserted: "so " },
      { at: 6, removed: "ick br", inserted: "" },
      { at: 0, removed: "The", inserted: "A" },
    ];
    for (const one of theirs) for (const two of mine) expect(carriedOver(two, one)).toEqual(transformSplices(one, two)[1]);
    for (const [a, b] of [["", "abc"], ["abc", ""], ["hello world", "hello brave world"], [base, "A quick fox"]]) {
      const ours = diffText(a!, b!);
      expect(a!.slice(0, ours.at) + ours.inserted + a!.slice(ours.at + ours.removed.length)).toBe(b);
      expect(ours).toEqual(diffSplice(a!, b!));
    }
  });

  it("carries a caret over somebody else's insertion, staying before one made where it stands", () => {
    expect(carrySelection({ start: 11, end: 11 }, { at: 4, removed: "", inserted: "very " })).toEqual({ start: 16, end: 16 });
    expect(carrySelection({ start: 4, end: 4 }, { at: 4, removed: "", inserted: "very " })).toEqual({ start: 4, end: 4 });
  });
});

describe("a field typed together, under a host that carries typing", () => {
  it("opens with no draft and no Save, and sends each keystroke as a splice", async () => {
    const store = storeWith("The quick fox");
    const { typing, sent } = typingInto(store);
    const area = await open(store, liveFor(typing));
    expect(host!.querySelector("[data-graview-live]")).not.toBeNull();
    expect([...host!.querySelectorAll("button")].map((one) => one.textContent)).not.toContain("Save");
    expect([...host!.querySelectorAll("button")].map((one) => one.textContent)).toContain("Done");
    await type(area, "The quick red fox", 14);
    expect(sent).toEqual([[10, 0, "red "]]);
    expect(store.graph.getNode("e")?.["body"]).toBe("The quick red fox");
    expect(store.log.all().at(-1)?.mutation?.name).toBe(TYPE_TEXT);
  });

  it("sends nothing while a word is composed, holds what others type until it is chosen, then both stand", async () => {
    const store = storeWith("Hello world");
    const { typing, sent } = typingInto(store);
    const area = await open(store, liveFor(typing));
    await act(async () => void area.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true })));
    await type(area, "Hello かな world", 8);
    expect(sent).toEqual([]);
    await bobTypes(store, 0, 0, "Oh, ");
    // Held: the area is the person's while they compose.
    expect(area.value).toBe("Hello かな world");
    await act(async () => void area.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true })));
    expect(sent).toEqual([[9, 0, " かな"]]);
    expect(store.graph.getNode("e")?.["body"]).toBe("Oh, Hello かな world");
    expect(area.value).toBe("Oh, Hello かな world");
  });

  it("keeps the caret on its word when somebody else's text lands before it", async () => {
    const store = storeWith("The quick fox jumps");
    const { typing } = typingInto(store);
    const area = await open(store, liveFor(typing));
    area.setSelectionRange(12, 12); // fo|x
    await bobTypes(store, 4, 0, "very ");
    expect(area.value).toBe("The very quick fox jumps");
    expect([area.selectionStart, area.selectionEnd]).toEqual([17, 17]);
    expect(area.value.slice(15, 18)).toBe("fox");
    // Text inserted where the caret stands goes after it: the person keeps typing where they were.
    await bobTypes(store, 17, 0, "!");
    expect([area.selectionStart, area.selectionEnd]).toEqual([17, 17]);
  });

  it("closes on Escape and puts nothing back: what was typed is everybody's already", async () => {
    const store = storeWith("Draft");
    const { typing } = typingInto(store);
    const area = await open(store, liveFor(typing));
    await type(area, "Draft two", 9);
    await act(async () => void area.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
    expect(host!.querySelector("textarea")).toBeNull();
    expect(store.graph.getNode("e")?.["body"]).toBe("Draft two");
  });

  it("takes back this person's own run with Ctrl or ⌘ Z, and not what somebody typed after it", async () => {
    const store = storeWith("The fox");
    const { typing } = typingInto(store);
    const area = await open(store, liveFor(typing));
    await type(area, "The red fox", 8);
    await bobTypes(store, 11, 0, " ran");
    expect(store.graph.getNode("e")?.["body"]).toBe("The red fox ran");
    await act(async () => {
      area.dispatchEvent(new KeyboardEvent("keydown", { key: "z", metaKey: true, bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(store.graph.getNode("e")?.["body"]).toBe("The fox ran");
    expect(area.value).toBe("The fox ran");
    await act(async () => {
      area.dispatchEvent(new KeyboardEvent("keydown", { key: "z", metaKey: true, shiftKey: true, bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(store.graph.getNode("e")?.["body"]).toBe("The red fox ran");
  });

  it("says where the person's caret stands, and draws another person's where it stands in this text", async () => {
    const store = storeWith("The quick fox");
    const { typing } = typingInto(store);
    const rev = store.log.length;
    const bob: Presence = { participant: "human:bob:tab", kind: "human", name: "Bob", hue: 200, stop: "#", at: new Date().toISOString(), caret: { node: "e", field: "body", anchor: 4, head: 4, rev } };
    const said: (PresenceCaret | null)[] = [];
    const area = await open(store, liveFor(typing, new Map([[bob.participant, bob]]), said));
    const caret = host!.querySelector<HTMLElement>('[data-graview-caret="human:bob:tab"]')!;
    expect(caret).not.toBeNull();
    expect(caret.title).toBe("Bob is typing here");
    expect(caret.parentElement!.getAttribute("aria-hidden")).toBe("true");
    // What stands before Bob's caret in the copy is the text before it.
    expect(caret.previousSibling?.textContent).toBe("The ");
    area.focus();
    await type(area, "A The quick fox", 2);
    await act(async () => new Promise((resolve) => setTimeout(resolve, 150)));
    expect(said.filter(Boolean).at(-1)).toMatchObject({ node: "e", field: "body", anchor: 2, head: 2 });
    // Ada typed before Bob's caret: it is carried with his word.
    expect(caretHere(bob.caret!, bob.participant, store.log.all(), 15)).toEqual({ start: 6, end: 6 });
    expect(host!.querySelector<HTMLElement>('[data-graview-caret="human:bob:tab"]')!.previousSibling?.textContent).toBe("A The ");
  });

  it("keeps the draft and its Save for prose the declaration writes whole", async () => {
    const store = storeWith("x");
    const { typing } = typingInto(store);
    await open(store, liveFor(typing), "notes");
    expect([...host!.querySelectorAll("button")].map((one) => one.textContent)).toContain("Save");
    expect(host!.querySelector("[data-graview-live]")).toBeNull();
  });
});

describe("without a host that carries typing", () => {
  it("prose typed together keeps the draft and its Save", async () => {
    const store = storeWith("x");
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => root!.render(<GraviewProvider store={store} views={createViews(schema)}><Fields id="e" /></GraviewProvider>));
    await act(async () => host!.querySelector<HTMLButtonElement>('[data-graview-long="body"] dt button')!.click());
    for (let tries = 0; tries < 100 && !host.querySelector("textarea"); tries++) await act(async () => new Promise((resolve) => setTimeout(resolve, 10)));
    expect([...host.querySelectorAll("button")].map((one) => one.textContent)).toContain("Save");
  });

  it("a provider handed `typing` gives it to the editor", async () => {
    const store = storeWith("Hi");
    const { typing, sent } = typingInto(store);
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => root!.render(<GraviewProvider store={store} views={createViews(schema)} principal={ADA} typing={async () => typing}><Fields id="e" /></GraviewProvider>));
    await act(async () => host!.querySelector<HTMLButtonElement>('[data-graview-long="body"] dt button')!.click());
    let area: HTMLTextAreaElement | null = null;
    for (let tries = 0; tries < 100; tries++) {
      area = host.querySelector("textarea");
      if (area && !area.readOnly) break;
      await act(async () => new Promise((resolve) => setTimeout(resolve, 10)));
    }
    await type(area!, "Hi!", 3);
    expect(sent).toEqual([[2, 0, "!"]]);
  });
});
