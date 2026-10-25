// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { bindSchema, createSchema, defineNode, nodeRef, Store, type Author } from "@graview/core";
import { suggest } from "@graview/core/tidying";
import { EMPTY_VIEW } from "@graview/layout";
import { createViews, GraviewProvider } from "@graview/react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { fetchInspector, registerDefaultViews, Shell } from "../../src/index.js";

beforeAll(() => fetchInspector());

/**
 * THE SUGGESTED TRAY NEVER SCROLLS SIDEWAYS (f-suggested-tray-overflow).
 * Threat Watch's seventeen suggestions named "@tanstack/react-router" and
 * ran their sentences, their basis and their chips past the panel's right
 * edge. jsdom lays nothing out, so what is held here is what the panel is
 * drawn with — no sideways scroll, lines that break anywhere, flex and
 * grid children that may shrink, a chip row that wraps and a chip cut with
 * its whole name in its title — and `pnpm verify chrome` measures it at
 * 320 px in a real browser (`theSuggestedTrayNeverScrollsSideways`).
 */
const task = defineNode("task", {
  fields: z.object({ label: z.string() }),
  plural: "Tasks",
  label: (node) => node.label,
  edges: { "waits-for": { to: ["task"], description: "what has to happen first", inverse: "what is waiting on this" } },
});
const schema = createSchema([task]);
const { defineMutation } = bindSchema(schema);
const waitFor = defineMutation("wait-for", {
  title: "This has to happen first",
  subject: { kinds: ["task"], arg: "taskId" },
  connects: ["waits-for"],
  input: z.object({ taskId: nodeRef(["task"]), blockerId: nodeRef(["task"]) }),
  describe: (args, graph) => `“${(graph.getNode(args.taskId) as { label: string }).label}” waits for “${(graph.getNode(args.blockerId) as { label: string }).label}”`,
  apply(ctx, args) {
    ctx.addEdge({ kind: "waits-for", from: args.taskId, to: args.blockerId });
  },
});
const actor: Author = { kind: "system", id: "tidying", name: "Graview, tidying", automated: true };
const nora = { kind: "human" as const, id: "nora", name: "Nora" };
/** A record's name of 120 characters with no space and no hyphen to break at. */
const LONG = `@tanstack/${"react_router_devtools_".repeat(6)}`.slice(0, 120);

(Element.prototype as { scrollTo?: unknown }).scrollTo = () => {};
let unmount: (() => Promise<void>) | undefined;
afterEach(async () => {
  await unmount?.();
  unmount = undefined;
  document.body.innerHTML = "";
});

async function settled(holds: () => void): Promise<void> {
  for (const end = Date.now() + 4000; ; ) {
    await act(async () => {
      await vi.dynamicImportSettled();
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    try {
      holds();
      return;
    } catch (error) {
      if (Date.now() > end) throw error;
    }
  }
}

describe("the Suggested tray, with seventeen suggestions on a record whose name is 120 characters and no space", () => {
  it("is drawn to wrap and cut rather than scroll sideways", async () => {
    expect(LONG).toHaveLength(120);
    expect(LONG).not.toMatch(/[\s-]/);
    const store = new Store({
      schema,
      mutations: [waitFor],
      snapshot: {
        nodes: [{ id: "long", kind: "task", label: LONG }, ...Array.from({ length: 17 }, (_, at) => ({ id: `t${at}`, kind: "task", label: `Package ${at}` }))] as never,
        edges: [],
      },
    });
    for (let at = 0; at < 17; at++) suggest(store, [{ name: "wait-for", args: { taskId: "long", blockerId: `t${at}` } }], { author: actor, lineage: { basis: `${LONG} shares a scope with Package ${at}`, confidence: 0.6 } });
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () =>
      root.render(
        <GraviewProvider store={store} views={registerDefaultViews(schema, createViews(schema))} initialView={{ ...EMPTY_VIEW, overview: true }} principal={nora}>
          <Shell<typeof schema> scheme="light" onScheme={() => {}} />
        </GraviewProvider>,
      ),
    );
    unmount = () => act(async () => root.unmount());
    await settled(() => expect(document.querySelector('[data-testid="suggested-button"]')).not.toBeNull());
    await act(async () => document.querySelector<HTMLElement>('[data-testid="suggested-button"]')!.click());
    const panel = document.querySelector<HTMLElement>('[data-testid="suggested"]')!;
    expect(panel.style.overflowX).toBe("hidden");
    expect(panel.style.overflowY).toBe("auto");
    const rows = [...panel.querySelectorAll<HTMLElement>('[data-testid="suggestion"]')];
    expect(rows).toHaveLength(17);
    for (const row of rows) {
      expect(row.style.minWidth).toBe("0px");
      expect(row.style.gridTemplateColumns).toBe("minmax(0, 1fr)");
      const words = row.querySelector<HTMLElement>("[data-graview-suggestion-words]")!;
      const basis = row.querySelector<HTMLElement>("[data-graview-lineage]")!;
      expect(words.textContent).toContain(LONG);
      expect(basis.textContent).toContain(LONG);
      for (const line of [words, basis]) expect(line.style.overflowWrap).toBe("anywhere");
      const chips = row.querySelector<HTMLElement>("[data-graview-suggestion-records]")!;
      expect(chips.style.flexWrap).toBe("wrap");
      expect(chips.style.minWidth).toBe("0px");
      const chip = [...chips.querySelectorAll<HTMLElement>('[data-graview-primitive="chip"]')].find((one) => one.textContent === LONG)!;
      expect(chip.title).toBe(LONG);
      expect(chip.style.maxWidth).toBe("min(28ch, 100%)");
      expect(chip.style.overflow).toBe("hidden");
    }
  });
});
