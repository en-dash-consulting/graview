// @vitest-environment jsdom
/* React's act() wants to know it is in a test environment. */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { createSchema, defineNode, Store, type SearchRanker } from "@graview/core";
import { EMPTY_VIEW } from "@graview/layout";
import { GraviewProvider, createViews } from "@graview/react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { FindBox, registerDefaultViews } from "../../src/index.js";

/**
 * FIND SAYS A NEAR HIT IS NEAR. A typo finds the record and the row says
 * the word it was near; the host's ranker (`ai.near`) is asked when the
 * exact hits are few, and its near ones join the strip as they arrive —
 * "the florist" is Bloom & Co, near “florist” by its tags: flowers.
 */
const vendor = defineNode("vendor", { fields: z.object({ label: z.string(), tags: z.string().optional() }), plural: "Vendors" });
const schema = createSchema([vendor]);

async function strip(q: string, near?: SearchRanker, settle?: () => Promise<void>) {
  const store = new Store({
    schema,
    mutations: [],
    invariants: [],
    snapshot: {
      nodes: [
        { id: "v-bloom", kind: "vendor", label: "Bloom & Co", tags: "flowers" },
        { id: "v-tulip", kind: "vendor", label: "Tulips Galore" },
      ] as never,
      edges: [],
    },
  });
  const views = registerDefaultViews(schema, createViews(schema));
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(() => {
    root.render(
      <GraviewProvider store={store} views={views} initialView={{ ...EMPTY_VIEW, q }} {...(near ? { ai: { near } } : {})}>
        <FindBox />
      </GraviewProvider>,
    );
  });
  const read = () => ({
    rows: [...host.querySelectorAll('[data-testid="find-hit"][data-about="node"]')].map((row) => ({ near: row.hasAttribute("data-near"), text: row.textContent ?? "" })),
    count: host.querySelector('[data-testid="find-count"]')?.textContent ?? "",
  });
  const first = read();
  if (settle) await act(settle);
  const then = read();
  root.unmount();
  host.remove();
  return { first, then };
}

describe("Find says a near hit is near", () => {
  it("finds a typo's record and says the word it was near", async () => {
    const { first } = await strip("tulpis");
    expect(first.rows).toEqual([{ near: true, text: "Tulips GaloreNear “tulpis”" }]);
    expect(first.count).toMatch(/1 of them near/);
  });

  it("shows the host's ranker's near hits as they arrive, said with the word that answered", async () => {
    let answer: (scores: { id: string; score: number; matched: string }[]) => void = () => {};
    const handed: string[] = [];
    const near: SearchRanker = (_query, candidates) => {
      handed.push(...candidates.map((candidate) => candidate.id));
      return new Promise((resolve) => (answer = resolve));
    };
    const { first, then } = await strip("the florist", near, async () => {
      answer([{ id: "v-bloom", score: 0.7, matched: "flowers" }]);
      await Promise.resolve();
    });
    expect(handed).toContain("v-bloom");
    expect(first.rows).toEqual([]);
    expect(then.rows).toEqual([{ near: true, text: "Bloom & CoNear “florist” — tags: flowers" }]);
  });
});
