// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { createSchema, defineNode, Store } from "@graview/core";
import { registerDefaultViews } from "@graview/primitives";
import { createViews } from "@graview/react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ONE_FACE_ARRIVING, PagesApp, type PageContext } from "../../src/index.js";

/**
 * THE PAGE SAYS WHILE THE ONE FACE IS ON ITS WAY. The one face's part is
 * fetched as the page first draws; meanwhile the routed page is drawn as
 * ever, and once the part arrives that page is drawn again inside it — new
 * elements for the bar, the links and the fields. On the nightly's runner
 * that came after the app said it was ready, and the journeys pressed links
 * in the page that was going ("no link to the Albums", "element was
 * detached"). `<html>` wears `data-graview-one-face-arriving` from the first
 * draw until the page that stays is drawn, and never on a face without the
 * city.
 */
const task = defineNode("task", { fields: z.object({ label: z.string() }), plural: "Tasks" });
const schema = createSchema([task]);
const store = () => new Store({ schema, mutations: [], snapshot: { nodes: [{ id: "t1", kind: "task", label: "Book the van" }] as never, edges: [] } });
const views = () => registerDefaultViews(schema, createViews(schema));

/** Every value the attribute took, from the first draw on, and the page's elements as they stood. */
async function watch(sceneUnderPages: boolean) {
  const said: boolean[] = [];
  const html = document.documentElement;
  const seen = new MutationObserver(() => said.push(html.hasAttribute(ONE_FACE_ARRIVING)));
  seen.observe(html, { attributes: true, attributeFilter: [ONE_FACE_ARRIVING] });
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => root.render(<PagesApp context={{ store: store(), views: views(), sceneUnderPages } as PageContext<typeof schema>} initialPath="/tasks" />));
  for (let turn = 0; turn < 200 && (html.hasAttribute(ONE_FACE_ARRIVING) || (sceneUnderPages && !host.querySelector("[data-graview-one-place]"))); turn++) {
    await act(async () => new Promise((resolve) => setTimeout(resolve, 5)));
  }
  await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));
  seen.disconnect();
  const result = { said, now: html.hasAttribute(ONE_FACE_ARRIVING), oneFace: host.querySelector("[data-graview-one-place]") !== null };
  await act(async () => root.unmount());
  host.remove();
  return result;
}

describe("the page says while the one face is on its way", () => {
  it("says it from the first draw until the one face has drawn the page that stays", async () => {
    const { said, now, oneFace } = await watch(true);
    expect(said[0]).toBe(true);
    expect(said.at(-1)).toBe(false);
    expect(now).toBe(false);
    expect(oneFace).toBe(true);
  });

  it("never says it on a face without the city", async () => {
    const { said, now, oneFace } = await watch(false);
    expect(said).toEqual([]);
    expect(now).toBe(false);
    expect(oneFace).toBe(false);
  });
});
