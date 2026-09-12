// @vitest-environment jsdom
/* React's act() wants to know it is in a test environment. */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { bindSchema, createSchema, defineNode, nodeRef, Store } from "@graview/core";
import { EMPTY_VIEW } from "@graview/layout";
import { GraviewProvider, createViews } from "@graview/react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { Inspector, registerDefaultViews } from "../../src/index.js";

/**
 * THE PANE KEEPS THE KEYBOARD'S PLACE — AND ONLY ITS OWN.
 *
 * W-053 taught the actions pane to put focus back on the act somebody was
 * standing on when that act's element went away underneath them. It told
 * "went away" from "left on purpose" by the blur's `relatedTarget`: null
 * meant removal. But a Tab from the last control in the document wraps
 * round to the first, and Chromium reports THAT with a null relatedTarget
 * too. So an ordinary Tab out of the pane left it holding a stale key, and
 * the next time focus fell to <body> anywhere on the page — a rename
 * committed in a card, six tabs away — the pane pulled the keyboard back
 * onto a pin toggle nobody had pressed.
 *
 * The honest question is whether the element the keyboard stood on is still
 * in the document. Here it is: the control is blurred with no relatedTarget
 * and stays exactly where it was, the graph changes underneath the pane,
 * and the pane must leave the keyboard alone.
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
const finish = defineMutation("finish", {
  title: "Finish it",
  description: "Mark a task done.",
  subject: { kinds: ["task"], arg: "id" },
  writes: ["done"],
  input: z.object({ id: nodeRef(["task"]) }),
  apply(ctx, args) {
    ctx.patchNode(args.id, { done: true });
  },
});

describe("the pane and a keyboard that left it", () => {
  it("does not reclaim the keyboard from work it had no part in", async () => {
    const store = new Store({
      schema,
      mutations: [rename, finish],
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
          initialSelection={["t1"]}
        >
          <Inspector />
        </GraviewProvider>,
      );
    });
    const pin = host.querySelector<HTMLButtonElement>('[data-testid="inspector-strip"] [data-pin-for]');
    expect(pin, "the pane offers an act with a pin beside it").not.toBeNull();

    // The keyboard stands on the pin, then leaves it the way a wrap-around
    // Tab does: focus goes, and nothing says where to.
    await act(async () => pin!.focus());
    expect(document.activeElement).toBe(pin);
    await act(async () => pin!.blur());
    expect(document.activeElement).toBe(document.body);
    expect(pin!.isConnected, "nothing was pulled out from under it").toBe(true);

    // Work happens elsewhere — the graph changes and the pane re-renders.
    await act(async () => {
      store.apply({ name: "rename", args: { id: "t1", label: "Pay the deposit, renamed" } });
    });
    expect(document.activeElement, "the pane must not pull the keyboard back onto a control nobody pressed").toBe(
      document.body,
    );
    await act(async () => root.unmount());
  });
});
