// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { bindSchema, createSchema, defineNode, nodeRef, Store, type Author, type Principal } from "@graview/core";
import { EMPTY_VIEW } from "@graview/layout";
import { createViews, GraviewProvider } from "@graview/react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { fetchInspector, registerDefaultViews, Shell } from "../../src/index.js";

beforeAll(() => fetchInspector());

/**
 * ACTIVITY NEVER SCROLLS SIDEWAYS (FR-226, Roadmap
 * f-activity-panel-no-sideways-scroll). A change to a record named in 120
 * characters with no space ran its sentence past the panel's right edge,
 * and the row's "as it was" and undo buttons sat past it, reached only by
 * scrolling sideways. jsdom lays nothing out, so what is held here is what
 * the panel is drawn with — as the Suggested tray's is
 * (`the-suggested-tray-never-scrolls-sideways.test.tsx`): no sideways
 * scroll, a panel no wider than the page, rows and lines that may shrink,
 * sentences that break anywhere, header rows that wrap, and a record chip
 * no wider than its row with its whole name in its title — and `pnpm verify
 * chrome` measures it at 320 px in a real browser
 * (`activityNeverScrollsSideways`).
 */
const task = defineNode("task", { fields: z.object({ label: z.string() }), plural: "Tasks", label: (node) => node.label, edges: { "waits-for": { to: ["task"], description: "what has to happen first" } } });
const schema = createSchema([task]);
const { defineMutation } = bindSchema(schema);
const rename = defineMutation("rename", {
  title: "Rename",
  subject: { kinds: ["task"], arg: "id" },
  writes: ["label"],
  input: z.object({ id: nodeRef(["task"]), label: z.string().min(1) }),
  describe: (args) => `Rename to "${args.label}"`,
  apply(ctx, args) {
    ctx.patchNode(args.id, { label: args.label });
  },
});
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
const nora: Principal = { kind: "human", id: "nora", name: "Nora" };
const actor: Author = { kind: "system", id: "tidying", name: "Graview, tidying", automated: true };
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

describe("Activity, after a change to a record whose name is 120 characters and no space", () => {
  it("is drawn to wrap and cut rather than scroll sideways, in a person's rows and in the actor's digest", async () => {
    expect(LONG).toHaveLength(120);
    expect(LONG).not.toMatch(/[\s-]/);
    const store = new Store({
      schema,
      mutations: [rename, waitFor],
      snapshot: { nodes: [{ id: "long", kind: "task", label: "Short" }, ...Array.from({ length: 3 }, (_, at) => ({ id: `t${at}`, kind: "task", label: `Package ${at}` }))] as never, edges: [] },
    });
    store.apply({ name: "rename", args: { id: "long", label: LONG } }, { author: nora });
    // The app's own actor's run, folded into one digest row that opens to each change.
    for (let at = 0; at < 3; at++) store.apply({ name: "wait-for", args: { taskId: "long", blockerId: `t${at}` } }, { author: actor, lineage: { basis: `${LONG} shares a scope with Package ${at}`, confidence: 0.9 } });
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
    await settled(() => expect(document.querySelector('[data-testid="activity-button"]')).not.toBeNull());
    await act(async () => document.querySelector<HTMLElement>('[data-testid="activity-button"]')!.click());
    await settled(() => expect(document.querySelector('[data-testid="activity"] [data-testid="digest-toggle"]')).not.toBeNull());
    await act(async () => document.querySelector<HTMLElement>('[data-testid="digest-toggle"]')!.click());
    await settled(() => expect(document.querySelectorAll('[data-testid="digest-change"]').length).toBe(3));

    const panel = document.querySelector<HTMLElement>('[data-testid="activity"]')!;
    // jsdom rewrites the calc: what is held is that the panel is the lesser of 300px and the page less its gutter.
    expect(panel.style.width).toMatch(/^min\(300px, .*100vw.*\)$/);
    expect(panel.style.overflowX).toBe("hidden");
    expect(panel.style.overflowY).toBe("auto");
    const rows = [...panel.querySelectorAll<HTMLElement>('[data-testid="diff-log"] > li, [data-testid="digest-change"]')];
    expect(rows.length).toBeGreaterThanOrEqual(5);
    expect(rows.filter((row) => row.textContent?.includes(LONG)).length).toBeGreaterThanOrEqual(4);
    for (const row of rows) {
      expect(row.style.minWidth).toBe("0px");
      expect(row.style.gridTemplateColumns).toBe("minmax(0, 1fr)");
      const head = row.querySelector<HTMLElement>("[data-graview-activity-head]")!;
      expect(head.style.flexWrap).toBe("wrap");
      expect(head.style.minWidth).toBe("0px");
      const words = row.querySelector<HTMLElement>("[data-graview-activity-words]")!;
      expect(words.style.overflowWrap).toBe("anywhere");
      expect(words.style.minWidth).toBe("0px");
      const chips = row.querySelector<HTMLElement>("[data-touched]");
      if (chips) {
        expect(chips.style.flexWrap).toBe("wrap");
        expect(chips.style.minWidth).toBe("0px");
      }
    }
    // The record's chip is cut by the chip, never wider than its row, its whole name in its title.
    const chips = [...panel.querySelectorAll<HTMLElement>('[data-testid="activity-record"]')].filter((chip) => chip.textContent === LONG);
    expect(chips.length).toBeGreaterThanOrEqual(1);
    for (const chip of chips) {
      expect(chip.style.maxWidth).toBe("100%");
      expect(chip.title).toBe(`Go to ${LONG}`);
      const inner = chip.querySelector<HTMLElement>('[data-graview-primitive="chip"]')!;
      expect(inner.style.maxWidth).toBe("min(28ch, 100%)");
      expect(inner.style.overflow).toBe("hidden");
    }
  });
});
