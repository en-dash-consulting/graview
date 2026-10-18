import { mkdtempSync, readFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
// @ts-expect-error — a plain .mjs module, typed by its use here.
import { judge, missedClaims, recordFlakes } from "../scripts/lib/second-look.mjs";

const run = (code: number, output = "") => ({ name: "navigation", file: "verify-navigation.mjs", code, took: 1, gist: "", output });
const navigationRed = `{\n  "theMarkHasTwoStates": false,\n  "theMarkMovesAsTheSceneDoes": false,\n  "aDistrictWithAPictureGoesIntoIt": true,\n  "ok": false\n}`;

describe("a harness that fails is looked at again, alone", () => {
  it("holds a harness that held the first time without a second look", () => {
    expect(judge(run(0)).verdict).toBe("held");
  });

  it("fails a harness that fails twice, and one never looked at again (--strict)", () => {
    expect(judge(run(1, navigationRed), run(1)).verdict).toBe("failed");
    expect(judge(run(1, navigationRed)).verdict).toBe("failed");
  });

  it("calls a harness that failed and then held a flake, naming the claims it missed the first time", () => {
    const judged = judge(run(1, navigationRed), run(0));
    expect(judged.verdict).toBe("flaky");
    expect(judged.code).toBe(0);
    expect(judged.missed).toEqual(["theMarkHasTwoStates", "theMarkMovesAsTheSceneDoes"]);
  });

  it("names claims, never the report's own ok or passed", () => {
    expect(missedClaims(`  "ok": false,\n  "passed": false\n  "bSeesAAtTheTasksPlot": false,`)).toEqual(["bSeesAAtTheTasksPlot"]);
  });

  it("writes each flake down, newest first, with the commit and the renderer it flaked on", () => {
    const root = mkdtempSync(join(tmpdir(), "flakes-"));
    mkdirSync(join(root, "docs"));
    recordFlakes(root, [{ name: "studio", missed: ["theHostsOwnButtonHeadingAndCodeAreAsTheHostStyledThem"] }], { sha: "72024d3d0000", renderer: "gpu" });
    recordFlakes(root, [{ name: "navigation", missed: ["theMarkHasTwoStates"] }], { sha: "72024d3d0000", renderer: "gpu" });
    const kept = JSON.parse(readFileSync(join(root, "docs/flakes.json"), "utf8"));
    expect(kept.map((one: { harness: string }) => one.harness)).toEqual(["navigation", "studio"]);
    expect(kept[1]).toMatchObject({ sha: "72024d3d", renderer: "gpu", missed: ["theHostsOwnButtonHeadingAndCodeAreAsTheHostStyledThem"] });
  });
});
