// @vitest-environment jsdom
import { createSchema, defineApp, defineNode, z, type AnySchema, type GraviewApp } from "@graview/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DRAWN_ATTRIBUTE, mount, type PagesEmbedHandle, type PagesEmbedOptions } from "../../src/pages.js";

/**
 * A LENS PLACE'S PICTURE SHOWS THE LENS'S CONTENT.
 *
 * `graview shots` photographed a declared lens's place — a blocks lens, a
 * status board — with its title and its line and nothing under it: the
 * page said `data-graview-drawn` while the lens was still to come. Its
 * module had arrived, but React draws a part that suspended in a commit it
 * holds back a moment after the page around it first drew, and the page
 * had not moved for long enough to be said settled. The place is said
 * drawn now only once the lens has drawn in it — so what a host pictures
 * on `data-graview-drawn` or `onDrawn`, and `graview shots` photographs,
 * is the lens's content. Run as React runs in a browser (no `act`), since
 * `act` draws everything at once and would hide what held back, and the
 * lens's module let through just after the page's head has drawn, as it
 * arrives in a browser. In a browser: `pnpm verify preview`.
 */
// A frame painted as a browser paints one, so the page is said drawn as soon after it settles as it would be there.
window.requestAnimationFrame ??= (paint: FrameRequestCallback) => setTimeout(() => paint(performance.now()), 16) as unknown as number;
const gate = vi.hoisted(() => {
  let open!: () => void;
  const opened = new Promise<void>((resolve) => (open = resolve));
  return { open, opened };
});
vi.mock("../../../primitives/src/declared-lenses.js", async (original) => {
  const module = await original();
  await gate.opened;
  return module;
});
const remediation = defineNode("remediation", { fields: z.object({ label: z.string(), audience: z.string() }), plural: "Remediations" });
const app = defineApp({
  name: "Threat Watch",
  schema: createSchema([remediation]),
  mutations: [],
  lenses: [
    {
      name: "blocks",
      title: "What to do",
      on: "remediation",
      create: false,
      options: { blocks: [{ text: "Grouped by who does it." }, { as: "row", list: "all('remediation')" }] },
    },
  ],
} as never) as unknown as GraviewApp<AnySchema>;
const plain = defineApp({ name: "Threat Watch", schema: createSchema([remediation]), mutations: [] }) as unknown as GraviewApp<AnySchema>;
const seed = {
  nodes: [
    { id: "r1", kind: "remediation", label: "Search lockfiles for the poisoned versions", audience: "developers" },
    { id: "r2", kind: "remediation", label: "Rotate npm, GitHub and cloud tokens", audience: "developers" },
  ],
  edges: [],
};

let handle: PagesEmbedHandle | undefined;
let host: HTMLElement | undefined;
afterEach(() => {
  handle?.unmount();
  host?.remove();
  handle = undefined;
  host = undefined;
});

/** What the root held at the moment it was first said drawn, read in the same task as the attribute went on. */
function whenSaidDrawn(container: HTMLElement): Promise<{ readonly path: string | null; readonly text: string }> {
  return new Promise((resolve, reject) => {
    const watch = new MutationObserver(() => {
      const root = container.querySelector("[data-graview-embed]");
      if (!root?.hasAttribute(DRAWN_ATTRIBUTE)) return;
      watch.disconnect();
      resolve({ path: root.getAttribute(DRAWN_ATTRIBUTE), text: root.textContent ?? "" });
    });
    watch.observe(container, { subtree: true, attributes: true, attributeFilter: [DRAWN_ATTRIBUTE] });
    setTimeout(() => reject(new Error("never said drawn")), 15_000);
  });
}

describe("a lens place's picture shows the lens's content", () => {
  it("says data-graview-drawn on a blocks lens's place only once its blocks have drawn", async () => {
    // Every other part of the page fetched once, on an app with no lens, so the lens is the one part still to come.
    const warm = document.createElement("div");
    document.body.appendChild(warm);
    const warmed = whenSaidDrawn(warm);
    const first = mount(warm, { app: plain, seed: { nodes: [], edges: [] }, fonts: false, path: "/remediations" } as PagesEmbedOptions);
    await warmed;
    first.unmount();
    // The lens's module compiled once, so that let through it arrives as quickly as a browser's cached chunk.
    await vi.importActual("../../../primitives/src/declared-lenses.js");
    warm.remove();
    host = document.createElement("div");
    document.body.appendChild(host);
    const said = whenSaidDrawn(host);
    const told: string[] = [];
    handle = mount(host, { app, seed, fonts: false, path: "/places/what-to-do", onDrawn: (place) => told.push(place.path) } as PagesEmbedOptions);
    // The page's head drawn, the lens suspended under it: its module arrives now.
    for (let spent = 0; !host.textContent?.includes("2 remediations") && spent < 10_000; spent += 5) await new Promise((resolve) => setTimeout(resolve, 5));
    expect(host.textContent, "the lens not yet drawn").not.toContain("Grouped by who does it.");
    gate.open();
    const drawn = await said;
    expect(drawn.path).toBe("/places/what-to-do");
    expect(drawn.text, "the page's title").toContain("What to do");
    expect(drawn.text, "the lens's own words").toContain("Grouped by who does it.");
    expect(drawn.text, "the lens's rows").toContain("Search lockfiles for the poisoned versions");
    expect(told).toEqual(["/places/what-to-do"]);
  }, 20_000);
});
