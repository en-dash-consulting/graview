// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { createSchema, defineApp, defineNode, z } from "@graview/core";
import { createPageRegistry, type PageComponent } from "@graview/pages";
import { registerDefaultViews } from "@graview/primitives";
import { createViews, type ViewComponent } from "@graview/react";
import { act } from "react";
import { beforeAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount, type EmbedError, type EmbedErrorWhere, type EmbedHandle, type EmbedOptions, preload } from "../../src/index.js";
import { mount as mountPages } from "@graview/embed/pages";

// Every face fetched before the first mount, so each draws in the commit `mount` makes (FR-57).
beforeAll(() => preload());

/**
 * AN EMBED REPORTS WHAT WENT WRONG AND HOW LONG IT TOOK, WITHOUT WHAT WAS
 * ON SCREEN (FR-24). An error inside a face was the browser's to report:
 * the host learned nothing, and a page that threw took the strip and the
 * other face down with it. A host observes failures and speed through two
 * callbacks, and what they carry is a class and a framework module's name,
 * never a record's words.
 */
const task = defineNode("task", { fields: z.object({ label: z.string() }), plural: "Tasks", label: (node: { label: string }) => node.label });
const schema = createSchema([task]);
const app = defineApp({ name: "Errands", schema, mutations: [] });
const seed = { nodes: [{ id: "t1", kind: "task", label: "Post the letter to Mrs Hale" }], edges: [] };

const mounted: { handle: { unmount(): void }; host: HTMLElement }[] = [];
beforeEach(() => {
  // The boundary says so on the console, for whoever fixes the view; not here.
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(async () => {
  for (const { handle, host } of mounted.splice(0)) {
    await act(async () => handle.unmount());
    host.remove();
  }
  vi.restoreAllMocks();
});
async function mounting(options: Omit<EmbedOptions<typeof schema>, "app">) {
  const host = document.createElement("div");
  document.body.append(host);
  let handle!: EmbedHandle;
  await act(async () => {
    handle = mount(host, { app, seed, fonts: false, ...options });
  });
  mounted.push({ handle, host });
  return { handle, host };
}

/** A picture of the list that cannot draw, and says the record's words while failing. */
const Throwing = ((props: { nodes?: readonly { label?: string }[] }) => {
  throw new TypeError(`cannot draw ${props.nodes?.[0]?.label ?? "Post the letter to Mrs Hale"}`);
}) as unknown as ViewComponent<typeof schema>;

describe("an error inside a face", () => {
  it("contains a view that throws, reports its class and module through onError, and keeps the rest of the face working", async () => {
    const reported: [EmbedError, EmbedErrorWhere][] = [];
    const { host, handle } = await mounting({
      face: "scene",
      stop: "#focus=agg:task",
      views: (s) => registerDefaultViews(s, createViews(s)).register("task", { cardinality: "many", fidelity: "full" }, Throwing, { title: "The list" }),
      onError: (error, where) => void reported.push([error, where]),
    });
    expect(host.querySelector("[data-graview-view-error]"), "the view's own panel says it could not draw").not.toBeNull();
    expect(reported.length).toBeGreaterThan(0);
    expect(reported[0]).toEqual([{ name: "TypeError" }, { module: "@graview/react", face: "scene" }]);
    expect(JSON.stringify(reported), "nothing that was on screen").not.toContain("Post the letter");

    // The strip, and the other face, still work.
    expect(host.querySelector("[data-testid=app-bar]")).not.toBeNull();
    await act(async () => host.querySelector<HTMLButtonElement>("[data-testid=app-home]")!.click());
    expect(host.querySelector("[data-graview-embed]")?.getAttribute("data-graview-embed")).toBe("pages");
    expect(host.textContent).toContain("Tasks");
    void handle;
  });

  it("contains a page that throws to its face: the strip stays and the scene is a press away", async () => {
    const Broken: PageComponent<typeof schema> = () => {
      throw new RangeError("Post the letter to Mrs Hale is out of range");
    };
    const pages = createPageRegistry<typeof schema, PageComponent<typeof schema>>(schema).surface("home", Broken);
    const reported: [EmbedError, EmbedErrorWhere][] = [];
    const { host } = await mounting({ face: "pages", pages, onError: (error, where) => void reported.push([error, where]) });
    expect(reported).toEqual([[{ name: "RangeError" }, { module: "@graview/pages", face: "pages" }]]);
    const said = host.querySelector("[data-graview-face-error]");
    expect(said, "the face says it could not draw").not.toBeNull();
    expect(said?.textContent).not.toContain("Post the letter");
    expect(host.querySelector("[data-testid=app-bar]"), "the bar").not.toBeNull();
    await act(async () => host.querySelector<HTMLButtonElement>("[data-testid=app-place-overview]")!.click());
    expect(host.querySelector("[data-graview-embed]")?.getAttribute("data-graview-embed")).toBe("scene");
    expect(host.querySelector("[data-graview-face-error]")).toBeNull();
  });
});

describe("onReady", () => {
  it("fires once, with the time to the first render, however the embed changes after", async () => {
    const ready: { ms: number; face: string }[] = [];
    const { handle } = await mounting({ face: "graview", onReady: (said) => void ready.push(said) });
    expect(ready).toHaveLength(1);
    expect(ready[0]!.face).toBe("graview");
    expect(ready[0]!.ms).toBeGreaterThanOrEqual(0);
    expect(ready[0]!.ms).toBeLessThan(10_000);
    await act(async () => handle.setFace("pages"));
    await act(async () => handle.setStop("#overview=1"));
    expect(ready).toHaveLength(1);
  });

  it("fires on the pages alone too", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const ready: { ms: number; face: string }[] = [];
    let handle!: { unmount(): void };
    await act(async () => {
      handle = mountPages(host, { app, seed, fonts: false, onReady: (said) => void ready.push(said) });
    });
    mounted.push({ handle, host });
    expect(ready).toEqual([{ ms: expect.any(Number), face: "pages" }]);
  });
});
