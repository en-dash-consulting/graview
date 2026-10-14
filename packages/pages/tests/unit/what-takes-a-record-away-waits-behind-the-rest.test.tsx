// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { bindSchema, createSchema, defineNode, nodeRef, Store } from "@graview/core";
import { createViews } from "@graview/react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { PagesApp, type PageContext } from "../../src/index.js";

/**
 * WHAT TAKES A RECORD AWAY WAITS ONE PRESS BEHIND THE REST (FR-173). On a
 * song's page, archive and merge came between "Change the song" and its
 * form, and renaming a song from the keyboard took 14 presses where it had
 * taken 10. Archive, merge and remove now wait behind "Show 3 more", which
 * hands the keyboard to the first of them.
 */
const song = defineNode("song", { fields: z.object({ title: z.string().min(1), key: z.string().optional() }), plural: "Songs", label: (node) => node.title });
const schema = createSchema([song]);
const { defineMutation } = bindSchema(schema);
const write = defineMutation("write-song", {
  title: "Write a song",
  creates: ["song"],
  input: z.object({ title: z.string().min(1) }),
  apply: (ctx, args) => void ctx.addNode({ id: ctx.freshId(args.title, "song"), kind: "song", title: args.title }),
});
const transpose = defineMutation("transpose", {
  title: "Transpose it",
  subject: { kinds: ["song"], arg: "id" },
  writes: ["key"],
  input: z.object({ id: nodeRef(["song"]) }),
  apply: (ctx, args) => ctx.patchNode(args.id, { key: "D" }),
});

describe("a record's acts", () => {
  it("keep archive, merge and remove behind Show more, which hands on the keyboard", async () => {
    const store = new Store({ schema, mutations: [write, transpose], snapshot: { nodes: [{ id: "s", kind: "song", title: "Blue Hour" }, { id: "t", kind: "song", title: "Gone" }] as never, edges: [] } });
    const context: PageContext<typeof schema> = { store, views: createViews(schema) };
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => root.render(<PagesApp context={context} initialPath="/songs/s" />));
    const offered = () => [...host.querySelectorAll<HTMLButtonElement>("[data-testid='record-actions'] [data-affordance]")].map((button) => button.getAttribute("data-affordance"));
    expect(offered()).toEqual(["schema:transpose", "schema:edit-song"]);
    const more = host.querySelector<HTMLButtonElement>("[data-testid='record-actions-more']")!;
    // And leaving it alone, which is about the record rather than its own work, waits with them.
    expect(more.textContent).toBe("Show 4 more");
    await act(async () => {
      more.click();
      await new Promise((done) => requestAnimationFrame(() => done(undefined)));
    });
    expect(offered()).toEqual(["schema:transpose", "schema:edit-song", "schema:archive-song", "schema:leave-alone-song", "schema:merge-song", "schema:remove-song"]);
    expect(document.activeElement?.getAttribute("data-affordance")).toBe("schema:archive-song");
    await act(async () => root.unmount());
    host.remove();
  });
});
