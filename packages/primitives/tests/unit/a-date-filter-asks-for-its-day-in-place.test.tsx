// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { createSchema, defineNode, Graph, isoDate, type Arrangement } from "@graview/core";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { ArrangeBar, preloadArrangeLists } from "../../src/index.js";

// The lists the line opens come when first wanted; here, before the first press.
await preloadArrangeLists();

/**
 * A DATE FILTER ASKS FOR ITS DAY IN PLACE. "Due before…" opened the
 * browser's own prompt — "which day? (YYYY-MM-DD)" — a box over the whole
 * page that asked a person to type the stored format. It asks beside the
 * choice now, with the browser's own date control, and the chip it adds
 * says the day as a person reads it.
 */
const task = defineNode("task", { fields: z.object({ label: z.string(), due: isoDate.optional() }), display: { labels: { due: "Due" } } });
const schema = createSchema([task]);
const graph = Graph.from(schema, { nodes: [{ id: "t1", kind: "task", label: "Book the van", due: "2026-09-01" }], edges: [] } as never);

const setValue = (element: HTMLInputElement | HTMLSelectElement, value: string) => {
  const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), "value")!.set!;
  setter.call(element, value);
  element.dispatchEvent(new Event(element instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }));
};

describe("a date filter", () => {
  it("asks for its day with a date control beside the choice, never the browser's prompt", async () => {
    const prompt = vi.fn(() => null);
    vi.stubGlobal("prompt", prompt);
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    let arrangement: Arrangement = {};
    const render = () => root.render(<ArrangeBar schema={schema} graph={graph} kind="task" arrangement={arrangement} onChange={(next) => { arrangement = next; render(); }} query={false} />);
    await act(async () => render());
    try {
      await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="arrange-add"]')!.click());
      await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="arrange-list"] [data-value="due:before"]')!.click());
      expect(prompt).not.toHaveBeenCalled();
      const day = host.querySelector<HTMLInputElement>('[data-testid="arrange-day"]');
      expect(day?.type).toBe("date");
      const add = host.querySelector<HTMLButtonElement>('[data-testid="arrange-day-add"]')!;
      expect(add.disabled, "nothing to add before a day is chosen").toBe(true);
      await act(async () => setValue(day!, "2026-09-15"));
      await act(async () => add.click());
      expect(arrangement.filter).toEqual([{ key: "due", value: "before:2026-09-15" }]);
      expect(host.querySelector('[data-testid="arrange-day"]'), "the ask is put away once answered").toBeNull();
      expect(host.querySelector('[data-testid="arrange-condition"]')?.textContent).toContain("Due before 15 Sep 2026");
    } finally {
      await act(async () => root.unmount());
      host.remove();
      vi.unstubAllGlobals();
    }
  });
});
