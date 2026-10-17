// @vitest-environment jsdom
/* React's act() wants to know it is in a test environment. */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { createSchema, defineNode, Store } from "@graview/core";
import { EMPTY_VIEW } from "@graview/layout";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { createViews, GraviewProvider, Scene, type SceneProps, type ViewProps } from "../../src/index.js";

/**
 * A PAGE WITHOUT THE GPU DRAWS ON THE DOM PATH AND SAYS NOTHING. `auto` is
 * the default; where WebGPU or element capture is absent — Firefox, older
 * Safari, jsdom — the scene is the ordinary container, nothing is fetched
 * and nothing is written to the console. A renderer that finds it cannot
 * draw after all hands the page back the same way.
 */
const task = defineNode("task", { fields: z.object({ label: z.string() }), plural: "Tasks" });
const schema = createSchema([task]);
function Tasks({ nodes, label }: ViewProps<typeof schema>) {
  return (
    <section>
      <h3>{label}</h3>
      <p>{nodes?.length ?? 0} tasks</p>
    </section>
  );
}
const views = () =>
  createViews(schema)
    .register("task", { cardinality: "many", fidelity: "full" }, Tasks)
    .register("task", { cardinality: "many", fidelity: "summary" }, Tasks)
    .register("task", { cardinality: "many", fidelity: "glyph" }, Tasks);
const store = () => new Store({ schema, mutations: [], snapshot: { nodes: [{ id: "t1", kind: "task", label: "Mow" }], edges: [] } });

let host: HTMLDivElement;
let root: Root;
let said: ReturnType<typeof vi.spyOn>[];
beforeEach(() => {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  said = [vi.spyOn(console, "error"), vi.spyOn(console, "warn"), vi.spyOn(console, "log")];
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  for (const spy of said) spy.mockRestore();
});

async function draw(scene: React.ReactElement) {
  await act(async () => {
    root.render(
      <GraviewProvider store={store()} views={views()} initialView={EMPTY_VIEW}>
        {scene}
      </GraviewProvider>,
    );
  });
  await act(async () => {
    await new Promise((settle) => setTimeout(settle, 0));
  });
}
const ground = () => host.querySelector<HTMLElement>(".graview-ground")!;

describe("a page without the GPU", () => {
  it("draws the scene on the DOM path by default, with no canvas and nothing said", async () => {
    await draw(<Scene animate={false} />);
    expect(ground().getAttribute("data-graview-renderer")).toBe("dom");
    expect(host.querySelector("canvas")).toBeNull();
    expect(host.querySelector('[data-graview-stage="dom"] > [data-graview-view]')).not.toBeNull();
    for (const spy of said) expect(spy).not.toHaveBeenCalled();
  });

  it("is handed back to the DOM path when the renderer finds it cannot draw", async () => {
    let fellBack: (() => void) | undefined;
    const attach: NonNullable<SceneProps["attachRenderer"]> = (scene) => {
      fellBack = scene.fallBack;
    };
    await draw(<Scene animate={false} renderer="gpu" attachRenderer={attach} />);
    expect(ground().getAttribute("data-graview-renderer")).toBe("gpu");
    expect(host.querySelector('canvas[data-graview-stage="gpu"] > [data-graview-view]')).not.toBeNull();
    await act(async () => fellBack?.());
    expect(ground().getAttribute("data-graview-renderer")).toBe("dom");
    expect(host.querySelector("canvas")).toBeNull();
    for (const spy of said) expect(spy).not.toHaveBeenCalled();
  });

  it("tells the renderer whether to blur, and the off switch turns it off", async () => {
    const asked: boolean[] = [];
    const attach: NonNullable<SceneProps["attachRenderer"]> = (scene) => {
      asked.push(scene.blur);
    };
    await draw(<Scene animate={false} renderer="gpu" attachRenderer={attach} />);
    expect(asked.at(-1)).toBe(true);
    expect(ground().hasAttribute("data-graview-blur")).toBe(true);
    await draw(<Scene animate={false} renderer="gpu" attachRenderer={attach} blur={false} />);
    expect(asked.at(-1)).toBe(false);
    expect(ground().hasAttribute("data-graview-blur")).toBe(false);
  });

  it("does not blur for a reader who asked for less transparency", async () => {
    const matchMedia = vi.fn((query: string) => ({
      matches: query.includes("reduced-transparency"),
      media: query,
      addEventListener() {},
      removeEventListener() {},
    }));
    vi.stubGlobal("matchMedia", matchMedia);
    try {
      await draw(<Scene animate={false} />);
      expect(ground().hasAttribute("data-graview-blur")).toBe(false);
      expect(host.querySelector<HTMLElement>("[data-graview-view]")!.style.filter).toBe("");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("does not blur once the reader's Motion setting says reduce", async () => {
    document.documentElement.setAttribute("data-graview-motion", "reduce");
    try {
      await draw(<Scene animate={false} />);
      expect(ground().hasAttribute("data-graview-blur")).toBe(false);
    } finally {
      await act(async () => document.documentElement.removeAttribute("data-graview-motion"));
    }
  });
});
