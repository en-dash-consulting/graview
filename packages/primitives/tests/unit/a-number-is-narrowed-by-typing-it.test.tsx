// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { createSchema, defineNode, Graph, type Arrangement } from "@graview/core";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { typedNumber } from "../../src/arrange-lists.js";
import { ArrangeBar, preloadArrangeLists } from "../../src/index.js";

await preloadArrangeLists();

/**
 * A NUMBER IS NARROWED BY TYPING IT (the tenth walk, carried). Narrowing by
 * a number was a heading opened and a walk down the round steps the list
 * happened to hold — and no step at all where every record held the same
 * number. Typed into the Filter list's own box, "35" offers "at most 35 min"
 * and "at least 35 min" first, one key away.
 */
const talk = defineNode("talk", {
  fields: z.object({ label: z.string(), minutes: z.number() }),
  plural: "Talks",
  display: { labels: { minutes: "Length" }, format: { minutes: (value) => `${value} min` } },
});
const schema = createSchema([talk]);
const graph = Graph.from(schema, { nodes: [15, 25, 30, 45, 60, 90].map((minutes, i) => ({ id: `t${i}`, kind: "talk", label: `Talk ${i}`, minutes })), edges: [] } as never);

const type = (element: HTMLInputElement, value: string) => {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(element, value);
  element.dispatchEvent(new Event("input", { bubbles: true }));
};

describe("a number typed into the Filter list", () => {
  it("reads a number the way a person types one", () => {
    expect(typedNumber("35")).toBe(35);
    expect(typedNumber(" 2.5 ")).toBe(2.5);
    expect(typedNumber("1,200")).toBe(1200);
    expect(typedNumber("length")).toBeNull();
    expect(typedNumber("30 min")).toBeNull();
  });

  it("offers at most and at least that number first, and one press narrows by it", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    let arrangement: Arrangement = {};
    const render = () => root.render(<ArrangeBar schema={schema} graph={graph} kind="talk" arrangement={arrangement} onChange={(next) => { arrangement = next; render(); }} query={false} />);
    await act(async () => render());
    try {
      await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="arrange-add"]')!.click());
      const box = host.querySelector<HTMLInputElement>('[data-testid="arrange-filter-find"]')!;
      await act(async () => type(box, "35"));
      const entries = [...host.querySelectorAll<HTMLButtonElement>('[data-testid="arrange-list"] .graview-arrange-item')];
      expect(entries.slice(0, 2).map((entry) => [entry.value, entry.textContent])).toEqual([
        ["minutes:at-most:35", "at most 35 min"],
        ["minutes:at-least:35", "at least 35 min"],
      ]);
      await act(async () => entries[0]!.click());
      expect(arrangement.filter).toEqual([{ key: "minutes", value: "at-most:35" }]);
    } finally {
      await act(async () => root.unmount());
      host.remove();
    }
  });
});
