import type { Presence } from "@graview/core";
import { describe, expect, it } from "vitest";
import type { DrawnBox } from "../../src/context.js";
import { anchorOf, AUDIENCE_ROW, placeOthers } from "../../src/placement.js";

/**
 * THE OTHERS, PLACED ON YOUR OWN MAP. A presence is a stop, never a
 * pixel; where somebody stands is asked of this viewer's `whereIs`, so
 * the placement is a pure function of who is where and what is drawn.
 */
const box = (x: number, y: number, width = 100, height = 60): DrawnBox => ({ x, y, width, height });
const drawn: Record<string, DrawnBox> = {
  "aggregate:task": box(100, 100),
  "kind:task": box(100, 100),
  "screen:task": box(300, 40, 200, 30),
  "t1": box(400, 300, 80, 40),
};
const whereIs = (id: string) => drawn[id] ?? null;
const here = (participant: string, stop: string, extra: Partial<Presence> = {}): Presence => ({
  participant,
  name: participant.split(":")[1],
  hue: 120,
  stop,
  at: new Date().toISOString(),
  ...extra,
});

describe("who is where", () => {
  it("reads a stop as the plot its focus names, or the audience row of the showing it watches", () => {
    expect(anchorOf("#focus=aggregate%3Atask")).toEqual({ at: "aggregate:task", audience: false });
    expect(anchorOf("#focus=aggregate%3Atask&in.view=week")).toEqual({ at: "screen:task", audience: true });
    expect(anchorOf("#focus=t1")).toEqual({ at: "t1", audience: false });
    expect(anchorOf("#overview=1")).toBeNull();
  });

  it("stands a person at the plot their stop focuses, in a row with the others there", () => {
    const placed = placeOthers([here("human:nora:a", "#focus=aggregate%3Atask"), here("human:sam:b", "#focus=aggregate%3Atask")], whereIs, 800);
    const people = placed.filter((one) => one.kind === "person");
    expect(people.map((one) => one.kind === "person" && one.presence.name)).toEqual(["nora", "sam"]);
    expect(people.every((one) => one.kind === "person" && one.at === "aggregate:task" && !one.audience)).toBe(true);
    // Two people, two places to stand.
    const [first, second] = people as Extract<(typeof placed)[number], { kind: "person" }>[];
    expect(first!.point.x).not.toBe(second!.point.x);
    expect(first!.point.y).toBe(drawn["aggregate:task"]!.y + drawn["aggregate:task"]!.height - 4);
  });

  it("puts somebody watching a showing in the audience row in front of that screen", () => {
    const [one] = placeOthers([here("human:nora:a", "#focus=aggregate%3Atask&in.view=week")], whereIs, 800);
    expect(one).toMatchObject({ kind: "person", at: "screen:task", audience: true });
    expect(one?.kind === "person" && one.point.y).toBe(drawn["screen:task"]!.y + 24);
  });

  it("draws a row and then a number: past the row, the rest are +n", () => {
    const many = Array.from({ length: AUDIENCE_ROW + 2 }, (_, i) => here(`human:p${i}:t`, "#focus=aggregate%3Atask&in.view=week"));
    const placed = placeOthers(many, whereIs, 800);
    expect(placed.filter((one) => one.kind === "person")).toHaveLength(AUDIENCE_ROW);
    expect(placed.find((one) => one.kind === "count")).toMatchObject({ n: 2, at: "screen:task" });
  });

  it("counts an anonymous viewer at their plot rather than drawing a figure", () => {
    const placed = placeOthers([here("human::x", "#focus=aggregate%3Atask", { name: undefined })], whereIs, 800);
    expect(placed).toEqual([expect.objectContaining({ kind: "count", n: 1, at: "aggregate:task" })]);
  });

  it("names somebody whose stop is nowhere on this map at the edge", () => {
    const placed = placeOthers([here("human:nora:a", "#focus=elsewhere")], whereIs, 800);
    expect(placed).toEqual([expect.objectContaining({ kind: "edge" })]);
    expect(placed[0]?.kind === "edge" && placed[0].point.x).toBe(792);
  });

  it("stands their robot where it works, captioned as theirs, and outlines what they point at", () => {
    const placed = placeOthers(
      [here("human:nora:a", "#focus=aggregate%3Atask", { robot: { at: "t1", mode: "writing" }, over: "t1" })],
      whereIs,
      800,
    );
    expect(placed.map((one) => one.kind)).toEqual(["person", "robot", "over"]);
    expect(placed[1]).toMatchObject({ kind: "robot", mode: "writing" });
    expect(placed[2]).toMatchObject({ kind: "over", box: drawn["t1"] });
  });

  it("leaves a docked robot at home: only a body at work is worth drawing twice", () => {
    const placed = placeOthers([here("human:nora:a", "#focus=t1", { robot: { at: null, mode: "docked" } })], whereIs, 800);
    expect(placed.map((one) => one.kind)).toEqual(["person"]);
  });
});
