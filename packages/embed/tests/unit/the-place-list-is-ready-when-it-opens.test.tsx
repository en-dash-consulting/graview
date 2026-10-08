// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { createSchema, defineApp, defineNode, z } from "@graview/core";
import { act } from "react";
import { describe, expect, it } from "vitest";
import { mount } from "../../src/index.js";

/**
 * THE PLACE LIST IS READY WHEN IT OPENS (FR-140). Graview Cloud, on a desk,
 * from the scene: press Pages, open the place list and choose "Vendors"
 * within a few hundred milliseconds — and the pick was dropped. The list
 * was open and the entry a real link, `aria-pressed` already said Pages,
 * but the routed face was still being fetched and its router not yet
 * listening, so the bar handed the pick to nobody (or to the router of the
 * last time Pages was drawn, gone since). A pick made the moment the list
 * is open goes to that place, however soon after pressing Pages.
 *
 * No `preload()` here: the face is fetched as it is drawn, as on a page.
 */
const plot = defineNode("plot", { fields: z.object({ label: z.string() }), plural: "Plots" });
const bed = defineNode("bed", { fields: z.object({ label: z.string() }), plural: "Beds" });
const schema = createSchema([plot, bed]);
const app = defineApp({ name: "Seedbed", schema, mutations: [] });
const seed = { nodes: [{ id: "p1", kind: "plot", label: "Plot one" }, { id: "b1", kind: "bed", label: "Bed one" }], edges: [] };

const settle = () => act(async () => new Promise((done) => setTimeout(done, 60)));
const heading = (host: HTMLElement) => [...host.querySelectorAll("[data-embed-content] h1, [data-embed-content] h2, [data-embed-content] h3")].map((one) => one.textContent?.trim().toLowerCase());

describe("a pick from the place list", () => {
  it("goes to its place when it is made in the same moment Pages is pressed, the first time and every time after", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    let handle: ReturnType<typeof mount> | undefined;
    await act(async () => {
      handle = mount(host, { app, seed: seed as never, face: "graview", principal: { kind: "human", id: "u", roles: [] }, fonts: false });
    });
    await settle();
    for (const [key, said] of [
      ["kind:plot", "plots"],
      ["kind:bed", "beds"],
      ["kind:plot", "plots"],
    ] as const) {
      // Pages, the list, the entry: no pause between them.
      await act(async () => {
        host.querySelector<HTMLButtonElement>('[data-testid="app-face-pages"]')!.click();
      });
      await act(async () => {
        host.querySelector<HTMLButtonElement>('[data-testid="app-places-open"]')!.click();
        host.querySelector<HTMLElement>(`[data-testid="app-place-${key}"]`)!.click();
      });
      // The face may still be fetched: wait for its page, not a pause.
      for (let tries = 0; tries < 60 && heading(host).length === 0; tries++) await settle();
      await settle();
      expect(heading(host), `${host.querySelector("[data-testid=app-place-current]")?.textContent} :: ${[...host.querySelectorAll("[data-embed-content] h1, [data-embed-content] h2, [data-embed-content] h3, [aria-busy]")].map((one) => one.tagName + one.textContent?.slice(0, 40)).join(" / ")}`).toContain(said);
      await act(async () => {
        host.querySelector<HTMLButtonElement>('[data-testid="app-face-scene"]')!.click();
      });
      await settle();
    }
    await act(async () => handle!.unmount());
    host.remove();
  }, 30_000);
});
