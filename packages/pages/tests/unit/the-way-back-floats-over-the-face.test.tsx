// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { bindSchema, createSchema, defineNode, nodeRef, Store, type Principal } from "@graview/core";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { PagesApp } from "../../src/index.js";

/**
 * THE WAY BACK FLOATS OVER THE FACE (FR-133).
 *
 * On an embed, "Take back “Mark done: Could Val lead…”" was a sticky box
 * at the top of the face's flow: it opened a band of its own under the
 * strip, pushed the heading and every row down, and cut its sentence off
 * with an ellipsis. It is a notice: fixed over the face at its foot, in no
 * row of the page, its sentence wrapping over lines before anything is
 * cut and whole in its name and title, said politely when it comes, and
 * marked as standing at the foot so another notice stands above it.
 */
const item = defineNode("item", { fields: z.object({ label: z.string() }), plural: "Items" });
const schema = createSchema([item]);
const { defineMutation } = bindSchema(schema);
const markDone = defineMutation("mark-done", {
  title: "Mark done",
  subject: { kinds: ["item"], arg: "id" },
  writes: ["label"],
  input: z.object({ id: nodeRef(["item"]) }),
  describe: () => "Mark done: Could Val lead the Thursday shift while Sam is away for the fortnight",
  apply(ctx, args) {
    ctx.patchNode(args.id, { label: "done" });
  },
});
const nina: Principal = { kind: "human", id: "nina", roles: ["keeper"] };

let unmount: (() => Promise<void>) | undefined;
afterEach(async () => {
  await unmount?.();
  unmount = undefined;
  document.body.innerHTML = "";
});

async function face(embedded: boolean) {
  const store = new Store({ schema, mutations: [markDone], invariants: [], snapshot: { nodes: [{ id: "i1", kind: "item", label: "Could Val lead" }] as never, edges: [] } });
  const host = document.createElement("div");
  host.setAttribute("data-embed-content", "");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => root.render(<PagesApp context={{ store, principal: nina, embedded }} initialPath="/" />));
  unmount = () => act(async () => root.unmount());
  await act(async () => {
    store.apply({ name: "mark-done", args: { id: "i1" } }, { author: nina });
  });
  return host;
}

describe("the way back, docked by the face", () => {
  for (const embedded of [true, false]) {
    describe(embedded ? "on an embed" : "on a page of its own", () => {
      it("is fixed over the face, in no row of its flow", async () => {
        const host = await face(embedded);
        const dock = host.querySelector<HTMLElement>('[data-testid="face-undo-dock"]')!;
        expect(dock).not.toBeNull();
        expect(dock.style.position).toBe("fixed");
        expect(dock.hasAttribute("data-graview-foot")).toBe(true);
        expect(dock.style.bottom).toContain("env(safe-area-inset-bottom");
      });

      it("wraps its sentence over lines rather than cutting it to one, and keeps the whole of it in its name and title", async () => {
        const host = await face(embedded);
        const button = host.querySelector<HTMLButtonElement>('[data-testid="page-undo"]')!;
        const words = "Take back “Mark done: Could Val lead the Thursday shift while Sam is away for the fortnight”";
        expect(button.textContent).toContain(words);
        expect(button.title).toContain(words);
        const sentence = [...button.querySelectorAll("span")].find((one) => one.textContent === words)!;
        expect(sentence.style.whiteSpace).not.toBe("nowrap");
        expect(Number(sentence.style.webkitLineClamp)).toBeGreaterThanOrEqual(2);
      });

      it("is said politely when it comes", async () => {
        const host = await face(embedded);
        await act(async () => new Promise((done) => setTimeout(done, 80)));
        const status = [...host.querySelectorAll('[role="status"]')].find((one) => one.textContent?.includes("Take back “Mark done: Could Val lead"));
        expect(status).toBeDefined();
        expect(status!.getAttribute("aria-live") ?? "polite").toBe("polite");
      });
    });
  }
});
