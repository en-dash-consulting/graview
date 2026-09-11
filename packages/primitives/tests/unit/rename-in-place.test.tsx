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
