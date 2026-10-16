import { describe, expect, it, vi } from "vitest";
import type { AiInteraction } from "@graview/core/catalog";
import { createAiDesk } from "../../src/ai-desk.js";

/**
 * THE INLINE AI'S DESK (Roadmap f-activity-ai-entries): one entry per
 * interaction, newest first, whether the page made it or the host handed it
 * back; every entry made or changed handed to the host's `keep`, and the
 * host's own asked for once.
 */
const entry = (id: string, at: string, outcome: AiInteraction["outcome"] = "offered"): AiInteraction => ({
  id,
  at,
  by: { kind: "human", id: "u-1" },
  target: { on: "record", id: "t-1" },
  targetLabel: "Book the van",
  ask: { kind: "fill", said: "Fill in" },
  offered: [],
  outcome,
});

describe("the AI desk", () => {
  it("keeps one entry per interaction, newest first, and hands each change to the host", () => {
    const keep = vi.fn();
    const desk = createAiDesk(() => ({ keep }));
    desk.record(entry("a", "2026-10-16T10:00:00Z"));
    desk.record(entry("b", "2026-10-16T11:00:00Z"));
    desk.record(entry("a", "2026-10-16T10:00:00Z", "accepted"));
    expect(desk.get().entries.map((one) => [one.id, one.outcome])).toEqual([
      ["b", "offered"],
      ["a", "accepted"],
    ]);
    expect(keep).toHaveBeenCalledTimes(3);
  });

  it("asks the host for its entries once, and draws them beside the page's", async () => {
    const load = vi.fn(async () => [entry("stored", "2026-10-15T09:00:00Z", "dismissed")]);
    const desk = createAiDesk(() => ({ load }));
    desk.record(entry("here", "2026-10-16T09:00:00Z"));
    desk.load();
    desk.load();
    await Promise.resolve();
    await Promise.resolve();
    expect(load).toHaveBeenCalledTimes(1);
    expect(desk.get().entries.map((one) => one.id)).toEqual(["here", "stored"]);
  });

  it("holds the one ghost waiting, and lets it go", () => {
    const desk = createAiDesk(() => undefined);
    const listener = vi.fn();
    desk.subscribe(listener);
    desk.setGhost({ ghost: { interaction: "a", target: { on: "record", id: "t-1" }, basis: "Fill in", proposals: [] } });
    expect(desk.get().ghost?.ghost.interaction).toBe("a");
    desk.setGhost(null);
    expect(desk.get().ghost).toBeNull();
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
