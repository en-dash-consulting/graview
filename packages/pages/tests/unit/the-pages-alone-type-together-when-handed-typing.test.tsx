// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { bindSchema, createSchema, defineNode, nodeRef, Store, TYPE_TEXT, type Principal } from "@graview/core";
import "@graview/core/typing";
import { createViews } from "@graview/react";
import type { FieldTyping } from "@graview/react/provider";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { PagesApp } from "../../src/index.js";

/**
 * THE PAGES ALONE TYPE TOGETHER WHEN HANDED TYPING (Roadmap f-collab-text,
 * phase 6). A host that draws the routed face with no embed around it — no
 * scene — hands `PagesApp` its served store's `typing`, and a
 * record's prose opens live: a keystroke is a splice sent at once, and no
 * Save is offered. A short string is still a whole value with a Save.
 */
const essay = defineNode("essay", {
  fields: z.object({ name: z.string(), body: z.string().max(20_000).optional() }),
  label: (node) => node.name,
  plural: "Essays",
});
const schema = createSchema([essay]);
const { defineMutation } = bindSchema(schema);
const edit = defineMutation("edit-essay", {
  title: "Change the essay",
  subject: { kinds: ["essay"], arg: "id" },
  writes: ["name", "body"],
  input: z.object({ id: nodeRef(["essay"]), name: z.string().optional(), body: z.string().max(20_000).optional() }),
  apply(ctx, args) {
    const { id, ...rest } = args;
    ctx.patchNode(id, rest);
  },
});
const ADA: Principal = { kind: "human", id: "ada", name: "Ada" };
const store = () => new Store({ schema, mutations: [edit], snapshot: { nodes: [{ id: "e1", kind: "essay", name: "On foxes", body: "The quick brown fox." }] as never, edges: [] } });
const setValue = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!;

let root: Root | undefined;
let host: HTMLElement | undefined;
afterEach(async () => {
  if (root) await act(async () => root!.unmount());
  host?.remove();
  root = undefined;
});

async function waitFor<T>(find: () => T | null | undefined): Promise<T> {
  for (let tries = 0; tries < 200; tries++) {
    const found = find();
    if (found) return found;
    await act(async () => new Promise((resolve) => setTimeout(resolve, 10)));
  }
  throw new Error("never appeared");
}

describe("the pages alone", () => {
  it("edit a field typed together live when handed typing, with no embed around them", async () => {
    const held = store();
    const sent: [number, number, string][] = [];
    const typing: FieldTyping = {
      splice(at, remove, insert) {
        sent.push([at, remove, insert]);
        held.apply({ name: TYPE_TEXT, args: { node: "e1", field: "body", at, remove, insert } }, { author: ADA });
      },
      flush() {},
      waiting: () => 0,
    };
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => root!.render(<PagesApp context={{ store: held, principal: ADA, views: createViews(schema) }} typing={async () => typing} initialPath="/essays/e1" />));
    const open = await waitFor(() => host!.querySelector<HTMLButtonElement>('[data-graview-long="body"] dt button'));
    await act(async () => open.click());
    const area = await waitFor(() => {
      const found = host!.querySelector<HTMLTextAreaElement>('[data-graview-live="body"] textarea');
      return found && !found.readOnly ? found : null;
    });
    const buttons = [...host.querySelectorAll('[data-graview-long="body"] button')].map((one) => one.textContent?.trim());
    expect(buttons).toContain("Done");
    expect(buttons).not.toContain("Save");
    await act(async () => {
      setValue.call(area, "The quick red fox.");
      area.setSelectionRange(13, 13);
      area.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(sent).toEqual([[10, 5, "red"]]);
    expect((held.graph.getNode("e1") as { body: string }).body).toBe("The quick red fox.");
    expect(held.log.all().map((op) => op.mutation?.name)).toEqual([TYPE_TEXT]);
  });
});
