import type { NearCandidate, NearScore } from "@graview/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RANKER_PAUSE, whenTypingPauses } from "../../src/context.js";

/**
 * FIND ASKS THE HOST'S RANKER WHEN THE TYPING PAUSES. A ranker may be a
 * model a call away, and Find searches on every keystroke: "florist" typed
 * a letter at a time asked the host seven times for words nobody would see
 * the answer to. Each ask now waits a moment, and one a later keystroke
 * overtook answers nothing without reaching the host.
 */
afterEach(() => {
  vi.useRealTimers();
});

const candidates: NearCandidate[] = [{ id: "v-bloom", kind: "vendor", label: "Bloom & Co", texts: [] }];

describe("Find's ask of the host's ranker", () => {
  it("reaches the host once for a word typed a letter at a time, with the last words", async () => {
    vi.useFakeTimers();
    const asked: string[] = [];
    const rank = whenTypingPauses(async (words) => {
      asked.push(words);
      return [{ id: "v-bloom", score: 0.7, matched: "flowers" }];
    });
    const answers: Promise<readonly NearScore[]>[] = [];
    for (const words of ["f", "fl", "flo", "flor", "flori", "floris", "florist"]) {
      answers.push(Promise.resolve(rank(words, candidates)));
      await vi.advanceTimersByTimeAsync(RANKER_PAUSE / 3);
    }
    await vi.advanceTimersByTimeAsync(RANKER_PAUSE);
    const said = await Promise.all(answers);
    expect(asked).toEqual(["florist"]);
    expect(said.slice(0, -1).every((answer) => answer.length === 0)).toBe(true);
    expect(said.at(-1)).toEqual([{ id: "v-bloom", score: 0.7, matched: "flowers" }]);
  });

  it("asks for each word typed with a pause between", async () => {
    vi.useFakeTimers();
    const asked: string[] = [];
    const rank = whenTypingPauses(async (words) => {
      asked.push(words);
      return [];
    });
    const first = Promise.resolve(rank("florist", candidates));
    await vi.advanceTimersByTimeAsync(RANKER_PAUSE);
    await first;
    const second = Promise.resolve(rank("baker", candidates));
    await vi.advanceTimersByTimeAsync(RANKER_PAUSE);
    await second;
    expect(asked).toEqual(["florist", "baker"]);
  });
});
