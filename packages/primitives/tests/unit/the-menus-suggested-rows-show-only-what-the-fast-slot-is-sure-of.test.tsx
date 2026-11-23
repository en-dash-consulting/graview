// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import type { FastProvider, HostAi } from "@graview/tools/frame";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { useSuggested, type MenuSuggestion } from "../../src/menu-suggested.js";

/**
 * THE MENU'S SUGGESTED ROWS, HELD TO THE FAST SLOT'S CONFIDENCE (Roadmap
 * f-jev-fast-polish). The menu opens with its suggestions in their first
 * order and the Fast slot re-ranks them; it showed its top three however
 * unsure it was. Now one under the floor is dropped once it answers, and
 * where three or fewer are offered — all of them shown, whatever their
 * order — it is not asked at all.
 */
const candidates = (n: number): MenuSuggestion[] => Array.from({ length: n }, (_, at) => ({ key: `act:${at}`, label: `Do thing ${at}`, mode: "chat" as const, source: "act" as const }));

/** A Fast slot that gives each suggestion, by its place, the chance it is handed. */
function ranking(chances: readonly number[]) {
  const calls = { n: 0 };
  const fast: FastProvider = {
    model: "jev-latest",
    decide: async (_state, questions) => {
      calls.n += 1;
      const pick = questions["pick"] as { criteria: Record<string, string> };
      const keys = Object.keys(pick.criteria);
      const probabilities = Object.fromEntries(keys.map((key, at) => [key, chances[at] ?? 0]));
      const best = [...keys].sort((a, b) => probabilities[b]! - probabilities[a]!)[0]!;
      return { answers: { pick: { type: "choice", choice: best, confidence: probabilities[best]!, probabilities } }, usage: { inputTokens: 5, outputTokens: 0 } };
    },
  };
  return { calls, fast };
}

let cleanup: (() => void) | undefined;
afterEach(() => {
  cleanup?.();
  cleanup = undefined;
});

/** The rows a menu would show for these candidates, as they stand after the Fast slot answers. */
async function shown(ai: HostAi, list: readonly MenuSuggestion[]): Promise<readonly MenuSuggestion[]> {
  let out: readonly MenuSuggestion[] = [];
  const opened = {};
  const depends = {};
  function Probe() {
    out = useSuggested(ai, list, { name: "Book the hall", opened, better: false, depends }, false);
    return null;
  }
  const host = document.createElement("div");
  const root = createRoot(host);
  await act(async () => root.render(<Probe />));
  await act(async () => new Promise((resolve) => setTimeout(resolve, 20)));
  cleanup = () => act(() => root.unmount());
  return out;
}

describe("the menu's Suggested rows", () => {
  it("drop what the Fast slot is less sure of than the floor, and say how sure it was of the rest", async () => {
    const { calls, fast } = ranking([0.05, 0.6, 0.1, 0.25]);
    const rows = await shown({ fast }, candidates(4));
    expect(calls.n).toBe(1);
    expect(rows.map((one) => one.key)).toEqual(["act:1", "act:3"]);
    expect(rows[0]).toMatchObject({ confidence: 0.6, model: "jev-latest" });
  });

  it("are none at all where it is sure of nothing", async () => {
    const { fast } = ranking([0.1, 0.1, 0.1, 0.1, 0.1]);
    expect(await shown({ fast }, candidates(5))).toEqual([]);
    // A host that holds it to less shows them again.
    expect((await shown({ fast, pickFloor: 0.05 }, candidates(5))).length).toBe(3);
  });

  it("ask nothing where three or fewer are offered, and show them as they are", async () => {
    const { calls, fast } = ranking([0.01, 0.01, 0.01]);
    const rows = await shown({ fast }, candidates(3));
    expect(calls.n).toBe(0);
    expect(rows.map((one) => one.key)).toEqual(["act:0", "act:1", "act:2"]);
    expect(rows.every((one) => one.confidence === undefined)).toBe(true);
  });
});
