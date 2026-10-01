// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { createSchema, defineNode, Graph, type Arrangement } from "@graview/core";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ArrangeBar } from "../../src/index.js";

/**
 * TWO CHANGES BEFORE ONE REDRAW ARE TWO CHANGES. On a slow runner a list's
 * grouping was chosen and a word typed before the page drew again, and the
 * word went on top of the old grouping: the link a person would send said
 * "by list" when they had asked "by size".
 */
const list = defineNode("list", { fields: z.object({ label: z.string() }), edges: { holds: { to: ["task"] } } });
const task = defineNode("task", { fields: z.object({ label: z.string(), size: z.enum(["small", "large"]) }) });
const schema = createSchema([list, task]);
const graph = Graph.from(schema, { nodes: [{ id: "t1", kind: "task", label: "Book the van", size: "small" }], edges: [] } as never);

describe("the arrange bar", () => {
  it("keeps the first change when a second comes before the page draws again", async () => {
    const sent: Arrangement[] = [];
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    // The page never redraws with what was sent: the slowest it can be.
    const opening: Arrangement = { group: { by: "holds" } };
    await act(async () => root.render(<ArrangeBar schema={schema} graph={graph} kind="task" testId="slow" arrangement={opening} onChange={(next) => sent.push(next)} />));
    const group = host.querySelector<HTMLSelectElement>('[data-testid="slow-group"]')!;
    const words = host.querySelector<HTMLInputElement>('[data-testid="slow-query"]')!;
    await act(async () => {
      group.value = "size";
      group.dispatchEvent(new Event("change", { bubbles: true }));
      const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
      set.call(words, "the");
      words.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(sent.at(-1)?.group?.by).toBe("size");
    expect(sent.at(-1)?.query).toBe("the");
    await act(async () => root.unmount());
    host.remove();
  });
});
