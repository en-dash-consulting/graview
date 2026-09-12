// @vitest-environment jsdom
/* React's act() wants to know it is in a test environment. */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { bindSchema, createSchema, defineNode, nodeRef, Store } from "@graview/core";
import { EMPTY_VIEW } from "@graview/layout";
import { GraviewProvider, Scene, createViews } from "@graview/react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { registerDefaultViews } from "../../src/index.js";

/**
 * RENAMING A RECORD IN PLACE, THROUGH THE SCENE.
 *
 * The editor is a one-field form inside a card, and a card is a keyboard
 * target in its own right — so the host's Enter and the field's Enter meet.
 * They met badly: the host called `preventDefault` before asking whose key
 * it was, the form never submitted, the field stayed open and nothing was
 * written. `pnpm remember` caught it in a browser; this catches it in a
 * second, which is the difference between finding it and finding it later.
 */
const task = defineNode("task", {
  fields: z.object({ label: z.string(), done: z.boolean() }),
  plural: "Tasks",
});
const schema = createSchema([task]);
const { defineMutation } = bindSchema(schema);
const rename = defineMutation("rename", {
  title: "Rename it",
  description: "Change what a task is called.",
  subject: { kinds: ["task"], arg: "id" },
  writes: ["label"],
  input: z.object({ id: nodeRef(["task"]), label: z.string().min(1) }),
  apply(ctx, args) {
    ctx.patchNode(args.id, { label: args.label });
  },
});

describe("the title edits in place", () => {
  it("commits on Enter, because the card does not swallow the field's key", async () => {
    const store = new Store({
      schema,
      mutations: [rename],
      invariants: [],
      snapshot: { nodes: [{ id: "t1", kind: "task", label: "Pay the deposit", done: false }] as never, edges: [] },
    });
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => {
      root.render(
        <GraviewProvider
          store={store}
          views={registerDefaultViews(schema, createViews(schema))}
          initialView={{ ...EMPTY_VIEW, focusId: "t1" }}
        >
          <Scene renderer="dom" />
        </GraviewProvider>,
      );
    });

    const opener = host.querySelector<HTMLElement>('[data-graview-editable][data-graview-field="label"]');
    expect(opener, "the title offers itself for editing").not.toBeNull();
    await act(async () => opener!.click());

    const field = host.querySelector<HTMLInputElement>('input[data-graview-field="label"]');
    expect(field, "clicking it opens a field").not.toBeNull();
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
      setter.call(field!, "Pay the deposit, remembered");
      field!.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => {
      field!.closest("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    expect((store.graph.getNode("t1") as { label: string }).label).toBe("Pay the deposit, remembered");
    // The field closed, and the change went through the mutation, so it is
    // in the log and can be taken back.
    expect(host.querySelectorAll('input[data-graview-field="label"]').length).toBe(0);
    expect(store.log.all()).toHaveLength(1);
    await act(async () => root.unmount());
  });

  it("does not let the card's own Enter reach a field being typed in", async () => {
    /*
     * The regression itself, in one assertion: a keydown from inside the
     * editor must not be prevented by the host, or the browser never
     * submits the form it belongs to.
     */
    const store = new Store({
      schema,
      mutations: [rename],
      invariants: [],
      snapshot: { nodes: [{ id: "t1", kind: "task", label: "Pay the deposit", done: false }] as never, edges: [] },
    });
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => {
      root.render(
        <GraviewProvider
          store={store}
          views={registerDefaultViews(schema, createViews(schema))}
          initialView={{ ...EMPTY_VIEW, focusId: "t1" }}
        >
          <Scene renderer="dom" />
        </GraviewProvider>,
      );
    });
    await act(async () =>
      host.querySelector<HTMLElement>('[data-graview-editable][data-graview-field="label"]')!.click(),
    );
    const field = host.querySelector<HTMLInputElement>('input[data-graview-field="label"]')!;
    const enter = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true });
    await act(async () => {
      field.dispatchEvent(enter);
    });
    expect(enter.defaultPrevented).toBe(false);
    await act(async () => root.unmount());
  });
});

describe("and the keyboard afterwards", () => {
  /*
   * THE VALUE IS THE CONTROL, AND THE KEYBOARD COMES BACK TO IT.
   *
   * Committing the editor unmounts the field, and a removed element takes
   * focus to <body> with it. So a rename made from the keyboard ended at the
   * top of the document — or, once the actions pane was holding a stale key,
   * on a pin toggle in the pane. The routed face never had this: its forms
   * stay mounted. The value's own button is where the keyboard was before
   * the edit, and it is where the keyboard belongs after.
   */
  const mount = async () => {
    const store = new Store({
      schema,
      mutations: [rename],
      invariants: [],
      snapshot: { nodes: [{ id: "t1", kind: "task", label: "Pay the deposit", done: false }] as never, edges: [] },
    });
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => {
      root.render(
        <GraviewProvider
          store={store}
          views={registerDefaultViews(schema, createViews(schema))}
          initialView={{ ...EMPTY_VIEW, focusId: "t1" }}
        >
          <Scene renderer="dom" />
        </GraviewProvider>,
      );
    });
    const opener = host.querySelector<HTMLElement>('[data-graview-editable][data-graview-field="label"]')!;
    await act(async () => {
      opener.focus();
      opener.click();
    });
    const field = host.querySelector<HTMLInputElement>('input[data-graview-field="label"]')!;
    expect(document.activeElement, "opening the editor puts the keyboard in the field").toBe(field);
    return { store, host, root, field };
  };
  const type = async (field: HTMLInputElement, text: string) =>
    act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(field, text);
      field.dispatchEvent(new Event("input", { bubbles: true }));
    });

  it("puts the keyboard back on the value it just changed", async () => {
    const { store, host, root, field } = await mount();
    await type(field, "Pay the deposit, remembered");
    await act(async () => {
      field.closest("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    expect((store.graph.getNode("t1") as { label: string }).label).toBe("Pay the deposit, remembered");
    const value = host.querySelector('[data-graview-editable][data-graview-field="label"]');
    expect(value?.textContent).toBe("Pay the deposit, remembered");
    expect(document.activeElement, "the keyboard is on the value again").toBe(value);
    await act(async () => root.unmount());
  });

  it("puts it back after Escape abandons the edit, too", async () => {
    const { host, root, field } = await mount();
    await act(async () => {
      field.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    expect(host.querySelectorAll("input[data-graview-field]").length).toBe(0);
    expect(document.activeElement).toBe(host.querySelector('[data-graview-editable][data-graview-field="label"]'));
    await act(async () => root.unmount());
  });

  it("leaves the keyboard wherever a blur sent it", async () => {
    const { host, root, field } = await mount();
    const elsewhere = document.createElement("button");
    document.body.appendChild(elsewhere);
    await type(field, "Pay the deposit, then left");
    // Somebody moved on: the edit commits, and the keyboard is theirs.
    await act(async () => elsewhere.focus());
    expect(host.querySelectorAll("input[data-graview-field]").length).toBe(0);
    expect(document.activeElement).toBe(elsewhere);
    elsewhere.remove();
    await act(async () => root.unmount());
  });
});
