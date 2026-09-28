// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { bindSchema, createSchema, defineNode, Store } from "@graview/core";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { Begin } from "../../src/index.js";

/**
 * THE WAY IN ON THE ROUTED FACE: a page with a heading, and a keyboard that
 * outlives the door. Found on a discography's first screen, empty: axe said
 * `page-has-heading-one`, and answering "Add a song" from the keyboard left
 * it on <body> once the door stood down for the home.
 */
const song = defineNode("song", { fields: z.object({ label: z.string() }), plural: "Songs", label: (node) => node.label });
const album = defineNode("album", { fields: z.object({ label: z.string() }), plural: "Albums", label: (node) => node.label });
const schema = createSchema([song, album]);
const { defineMutation } = bindSchema(schema);
const adder = (kind: "song" | "album") =>
  defineMutation(`add-${kind}`, {
    title: `Add a ${kind}`,
    creates: [kind],
    input: z.object({ label: z.string().min(1) }),
    apply: (ctx, args) => void ctx.addNode({ id: ctx.freshId(args.label, kind), kind, label: args.label } as never),
  });

async function door(kinds: readonly ("song" | "album")[]) {
  const store = new Store({ schema, mutations: kinds.map(adder) as never, invariants: [] });
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(
      <Begin
        store={store}
        whenFull={<main><h1>Home</h1></main>}
        frame={(inside) => <main>{inside}</main>}
      />,
    );
  });
  return { host, store, unmount: () => act(() => root.unmount()) };
}

async function answer(host: HTMLElement, testId: string, label: string) {
  const button = host.querySelector<HTMLButtonElement>(`[data-testid="${testId}"]`)!;
  button.focus();
  await act(async () => button.click());
  const input = host.querySelector<HTMLInputElement>("input")!;
  input.focus();
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  await act(async () => {
    setter.call(input, label);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () => {
    input.form!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
}

describe("the way in, on a page of its own", () => {
  it("is the page's level-one heading when it is framed as the page", async () => {
    const { host, unmount } = await door(["song"]);
    expect(host.querySelector("h1")?.textContent).toBe("Begin");
    await unmount();
  });

  it("hands the keyboard to the home it stands down for, not to the body", async () => {
    const { host, store, unmount } = await door(["song"]);
    await answer(host, "begin-add-song", "Blue Hour");
    expect(store.graph.nodesOfKind("song")).toHaveLength(1);
    expect(host.querySelector("h1")?.textContent).toBe("Home");
    expect(document.activeElement).not.toBe(document.body);
    expect(document.activeElement?.textContent).toBe("Home");
    await unmount();
  });

  it("hands it to the next way in while the door is still up", async () => {
    const { host, unmount } = await door(["song", "album"]);
    await answer(host, "begin-add-song", "Blue Hour");
    expect(document.activeElement?.getAttribute("data-testid")).toBe("begin-add-album");
    await unmount();
  });
});
