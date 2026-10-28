import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { compileDocument } from "../../src/check.js";
import { cityMap } from "../../src/city.js";
import type { GraviewApp } from "../../src/index.js";
import { agoWords, lastRunWords, workflowSpots, workflowsOnTheMap, type RunSaid } from "../../src/workflows.js";

/**
 * A WORKFLOW STANDS ON THE MAP BESIDE WHAT IT WRITES (Roadmap
 * f-jobs-declared, the Scene's part). From altitude a workflow is drawn in
 * the street beside the district it writes first, wired to every kind its
 * steps say they read and write — never on a district's ground — a paused
 * one known as paused, and its last run said in words when the host keeps
 * a log of them.
 */

const household = (): GraviewApp => {
  const document = JSON.parse(readFileSync(new URL("../document/fixtures/workflows.gdd.json", import.meta.url), "utf8")) as Record<string, unknown>;
  const compiled = compileDocument(document as never);
  if (!compiled.ok) throw new Error(JSON.stringify(compiled.findings));
  return compiled.app as GraviewApp;
};

const run = (over: Partial<RunSaid> = {}): RunSaid => ({ finished: "2026-10-25T18:02:00Z", outcome: "ok", dry: false, made: [], changed: [], archived: [], suggested: [], ...over });

describe("a workflow on the map", () => {
  it("is wired to the kinds its steps read and write, and what starts it on a change", () => {
    const on = workflowsOnTheMap(household());
    expect(on.map((one) => [one.name, one.reads, one.writes])).toEqual([
      ["next-weeks-events", ["routine"], ["event"]],
      ["keep-events-in-step", ["plan-item", "event"], ["event"]],
      ["set-aside-done-lists", ["grocery-list"], ["grocery-list"]],
    ]);
    expect(on.find((one) => one.name === "next-weeks-events")!.steps).toEqual(["Run “add-event” for each routine where active"]);
  });

  it("knows a paused workflow as paused, and an unsaid status as active", () => {
    const on = workflowsOnTheMap(household());
    expect(Object.fromEntries(on.map((one) => [one.name, one.status]))).toEqual({ "next-weeks-events": "active", "keep-events-in-step": "active", "set-aside-done-lists": "paused" });
  });

  it("is nothing for an app that declares no workflow", () => {
    const app = household();
    expect(workflowsOnTheMap({ ...app, workflows: undefined } as GraviewApp)).toEqual([]);
  });

  it("stands in the street beside the district it writes first, a cell apart from another beside it, and never on any district's ground", () => {
    const app = household();
    const map = cityMap(app.schema);
    const spots = workflowSpots(workflowsOnTheMap(app), map);
    expect(spots.map((spot) => [spot.name, spot.beside])).toEqual([
      ["next-weeks-events", "event"],
      ["keep-events-in-step", "event"],
      ["set-aside-done-lists", "grocery-list"],
    ]);
    const event = map.get("event")!;
    expect(spots[0]).toMatchObject({ col: event.col + event.side + 1, row: event.row + 0.5 });
    expect(spots[1]).toMatchObject({ col: event.col + event.side + 1, row: event.row + 1.5 });
    for (const spot of spots) {
      for (const plot of map.values()) {
        const inside = spot.col > plot.col && spot.col < plot.col + plot.side && spot.row > plot.row && spot.row < plot.row + plot.side;
        expect(inside).toBe(false);
      }
    }
  });

  it("is not placed when it touches no kind on the map", () => {
    const app = household();
    const spots = workflowSpots(workflowsOnTheMap(app), new Map([["routine", { col: 0, row: 0, side: 2 }]]));
    expect(spots.map((spot) => spot.name)).toEqual(["next-weeks-events"]);
  });
});

describe("its last run, in words", () => {
  const now = "2026-10-25T20:02:00Z";
  it("says when it ran and what it made and changed", () => {
    expect(lastRunWords(run({ made: ["e1", "e2", "e3"], changed: ["e4"] }), now)).toBe("Last ran 2 hours ago: made 3, changed 1");
  });
  it("says a run with nothing to do as nothing new", () => {
    expect(lastRunWords(run({ outcome: "nothing-new" }), now)).toBe("Last ran 2 hours ago: nothing new");
  });
  it("says a dry run as what it would have done", () => {
    expect(lastRunWords(run({ dry: true, made: ["e1"], archived: ["g1"] }), now)).toBe("Last ran 2 hours ago, as a dry run: would make 1, would set aside 1");
  });
  it("says a failure, a hold and a part that did not run", () => {
    expect(lastRunWords(run({ outcome: "failed" }), now)).toBe("Last ran 2 hours ago and failed");
    expect(lastRunWords(run({ outcome: "held" }), now)).toBe("Last ran 2 hours ago: held back");
    expect(lastRunWords(run({ outcome: "partial", suggested: ["s1"] }), now)).toBe("Last ran 2 hours ago: suggested 1 (part of it did not run)");
  });
  it("says a workflow that never ran", () => {
    expect(lastRunWords(undefined, now)).toBe("Has not run yet");
  });
  it("says how long ago in a person's words", () => {
    expect(agoWords("2026-10-25T20:01:30Z", now)).toBe("just now");
    expect(agoWords("2026-10-25T20:01:00Z", now)).toBe("a minute ago");
    expect(agoWords("2026-10-25T19:30:00Z", now)).toBe("32 minutes ago");
    expect(agoWords("2026-10-25T19:00:00Z", now)).toBe("an hour ago");
    expect(agoWords("2026-10-24T19:00:00Z", now)).toBe("yesterday");
    expect(agoWords("2026-10-20T19:00:00Z", now)).toBe("5 days ago");
  });
});
