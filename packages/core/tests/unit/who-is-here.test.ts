import { describe, expect, it } from "vitest";
import { foldPresence, samePresence, type Presence } from "../../src/presence.js";

/**
 * PRESENCE IS NOT THE OP LOG. What a viewer sees of the others is a fold
 * over what arrived, with the quiet ones gone and itself left out.
 */
const at = (ms: number) => new Date(ms).toISOString();
const here = (participant: string, ms: number, stop = "#focus=aggregate%3Atask"): Presence => ({
  participant,
  name: participant.split(":")[1],
  hue: 200,
  stop,
  at: at(ms),
});

describe("who is here", () => {
  it("keeps whoever spoke inside the window and drops whoever went quiet", () => {
    const known = new Map([["human:nora:a", here("human:nora:a", 0)]]);
    const seen = foldPresence(known, [here("human:sam:b", 2000)], 2600, 2500);
    expect([...seen.keys()]).toEqual(["human:sam:b"]);
  });

  it("takes the newer word about the same person and never an older one", () => {
    const known = new Map([["human:nora:a", here("human:nora:a", 1000, "#focus=x")]]);
    const older = foldPresence(known, [here("human:nora:a", 500, "#focus=old")], 1200, 2500);
    expect(older.get("human:nora:a")?.stop).toBe("#focus=x");
    const newer = foldPresence(known, [here("human:nora:a", 1100, "#focus=new")], 1200, 2500);
    expect(newer.get("human:nora:a")?.stop).toBe("#focus=new");
  });

  it("leaves yourself out: you are at the keyboard, not on the map", () => {
    const seen = foldPresence(new Map(), [here("human:nora:a", 0), here("human:sam:b", 0)], 10, 2500, "human:nora:a");
    expect([...seen.keys()]).toEqual(["human:sam:b"]);
  });

  it("a presence that arrives already stale is not a presence", () => {
    const seen = foldPresence(new Map(), [here("human:sam:b", 0)], 5000, 2500);
    expect(seen.size).toBe(0);
  });

  it("knows when two readings would draw the same figure", () => {
    const a = here("human:nora:a", 0);
    expect(samePresence(a, { ...a, at: at(800) })).toBe(true);
    expect(samePresence(a, { ...a, stop: "#focus=y" })).toBe(false);
    expect(samePresence(a, { ...a, robot: { at: "t1", mode: "writing" } })).toBe(false);
    expect(samePresence(undefined, undefined)).toBe(true);
  });
});
