// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { createSchema, defineApp, defineNode, z, type GraviewApp } from "@graview/core";
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mount, type EmbedHandle, type EmbedOptions } from "../../src/index.js";
import { mount as mountPages, type PagesEmbedHandle } from "@graview/embed/pages";

/**
 * AN EMBED KNOWS WHAT ITS HOST CAN KEEP (FR-19).
 *
 * Mounted over a hosted store, the strip still offered the Studio, whose
 * changes can only be written through a dev server's door, so a hosted
 * reader could change a declaration that would never be saved. A host
 * either hides the studio or takes what it applies: a hosted app turns an
 * applied declaration into a proposal of its own.
 */
const task = defineNode("task", { fields: z.object({ label: z.string(), notes: z.string().optional() }), plural: "Tasks", label: (node: { label: string }) => node.label });
const schema = createSchema([task]);
const app = defineApp({ name: "Errands", schema, mutations: [] });
const seed = { nodes: [{ id: "t1", kind: "task", label: "Post the letter" }], edges: [] };

const mounted: { handle: EmbedHandle; host: HTMLElement }[] = [];
afterEach(async () => {
  for (const { handle, host } of mounted.splice(0)) {
    await act(async () => handle.unmount());
    host.remove();
  }
  vi.unstubAllGlobals();
});
async function mounting(options: Omit<EmbedOptions<typeof schema>, "app">) {
  const host = document.createElement("div");
  document.body.append(host);
  let handle!: EmbedHandle;
  await act(async () => {
    handle = mount(host, { app, seed, face: "graview", fonts: false, ...options });
  });
  mounted.push({ handle, host });
  return { handle, host };
}

/** The studio is imported when it is turned on, so it arrives a moment after the embed does. */
async function untilTheStudioArrives(host: HTMLElement) {
  for (let tries = 0; tries < 100 && !host.querySelector("[data-testid=studio-place]"); tries++) {
    await act(async () => new Promise((resolve) => setTimeout(resolve, 10)));
  }
}

describe("@graview/embed/pages", () => {
  it("mounts the routed face alone: the strip and the pages, no scene and no studio", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    let handle!: PagesEmbedHandle;
    await act(async () => {
      handle = mountPages(host, { app, seed, fonts: false, people: [{ id: "acct_7f3", name: "Nick" }] });
    });
    const root = host.querySelector("[data-graview-embed]");
    expect(root?.getAttribute("data-graview-embed")).toBe("pages");
    expect(host.textContent).toContain("Tasks");
    expect(host.querySelector("[data-testid=embed-faces]"), "the strip").not.toBeNull();
    expect(host.querySelector("[data-testid=embed-face-scene]")).toBeNull();
    expect(host.querySelector("[data-testid=studio-place]")).toBeNull();
    await act(async () => handle.setHostContext({ theme: "dark" }));
    expect(root?.getAttribute("data-graview-scheme")).toBe("dark");
    await act(async () => handle.unmount());
    host.remove();
  });
});

/** Remove task's notes in the studio: open the fields, pick it, and press "Remove the field" on its strip. */
async function removeTheNotes(host: HTMLElement) {
  const studio = host.querySelector("[data-testid=studio]")!;
  const open = [...studio.querySelectorAll<HTMLButtonElement>('[data-graview-view="kind:field"] button')].find((button) => button.textContent?.includes("open"));
  for (let tries = 0; tries < 20 && !studio.querySelector('[data-graview-pick="field:task.notes"]'); tries += 1) {
    if (open!.getAttribute("aria-expanded") !== "true") await act(async () => open!.click());
    await act(async () => new Promise((wait) => setTimeout(wait, 50)));
  }
  const pick = studio.querySelector<HTMLElement>('[data-graview-pick="field:task.notes"]');
  expect(pick, "task's notes in the scene").not.toBeNull();
  await act(async () => {
    pick!.focus();
    pick!.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  });
  const remove = [...studio.querySelectorAll<HTMLButtonElement>('[data-testid="inspector-strip"] [data-affordance]')].find((button) => button.textContent?.startsWith("Remove the field"));
  await act(async () => remove!.click());
}

describe("an embed's studio", () => {
  it("is offered by default, and not at all with studio: false", async () => {
    const offered = await mounting({});
    await untilTheStudioArrives(offered.host);
    expect(offered.host.querySelector("[data-testid=studio-place]")).not.toBeNull();
    const hidden = await mounting({ studio: false });
    // As long as the offered one took to arrive, and then some: it is not late, it is not coming.
    await act(async () => new Promise((resolve) => setTimeout(resolve, 50)));
    expect(hidden.host.querySelector("[data-testid=embed-faces]"), "the strip is still there").not.toBeNull();
    expect(hidden.host.querySelector("[data-testid=studio-place]")).toBeNull();
  });

  it("hands what it applies to the host's onApply and writes nothing itself", async () => {
    const fetches: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => (fetches.push(String(input)), new Response("{}", { status: 404 }))));
    const handed: { app: GraviewApp; migration: unknown }[] = [];
    const { host } = await mounting({ studio: { onApply: (applied) => void handed.push(applied) } });
    await untilTheStudioArrives(host);
    await act(async () => host.querySelector<HTMLButtonElement>("[data-testid=studio-place]")!.click());
    expect(host.querySelector("[data-testid=studio]"), "the studio opened").not.toBeNull();
    // A change to hand over, made as a person would: with nothing changed the host is not asked (FR-65).
    await removeTheNotes(host);
    await act(async () => host.querySelector<HTMLButtonElement>("[data-testid=studio-apply]")!.click());

    expect(handed).toHaveLength(1);
    expect(handed[0]!.app.name).toBe("Errands");
    expect(handed[0]!.app.schema.kinds).toContain("task");
    const said = host.querySelector("[data-testid=studio-applied]");
    expect(said?.textContent).toContain("Handed to");
    expect(said?.querySelector("a[download]"), "no files offered to download").toBeNull();
    expect(fetches, "no door asked after, nothing sent").toEqual([]);
  });
});
