import { existsSync, mkdtempSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
// @ts-expect-error — a plain .mjs module, typed by its use here.
import { judge, keepFirstLook, lookTwice, missedClaims, missedOf, recordFlakes } from "../scripts/lib/second-look.mjs";

/** A cell of the engine matrix (scripts/verify-engines.mjs) whose looks answer in turn. */
const answering = (...looks: Array<Record<string, unknown>>) => {
  const asked: number[] = [];
  return { asked, look: async (n: number) => (asked.push(n), looks[Math.min(n, looks.length) - 1]) };
};
const firefoxAudit = { ok: false, screens: 12, errors: ["todo/selected: page.click: Timeout 30000ms exceeded"] };

describe("an engine's cell that fails is looked at again, alone", () => {
  it("holds a cell that held, asking once", async () => {
    const cell = answering({ ok: true, screens: 12 });
    expect(await lookTwice(cell.look)).toMatchObject({ ok: true, verdict: "held" });
    expect(cell.asked).toEqual([1]);
  });

  it("calls a cell that failed and then held a flake, keeping the first look and the screens it missed", async () => {
    const cell = answering(firefoxAudit, { ok: true, screens: 12 });
    const judged = await lookTwice(cell.look);
    expect(cell.asked).toEqual([1, 2]);
    expect(judged).toMatchObject({ ok: true, verdict: "flaky", missed: ["todo/selected: page.click: Timeout 30000ms exceeded"], firstLook: firefoxAudit });
  });

  it("keeps a cell that fails twice red, and one --strict never looks at again", async () => {
    expect(await lookTwice(answering(firefoxAudit, firefoxAudit).look)).toMatchObject({ ok: false, verdict: "failed" });
    const strict = answering(firefoxAudit, { ok: true });
    expect(await lookTwice(strict.look, { strict: true })).toMatchObject({ ok: false, verdict: "failed" });
    expect(strict.asked).toEqual([1]);
  });

  it("names what a cell missed: its screens, its false claims, or its error", () => {
    expect(missedOf({ ok: false, paneWentAway: false, tabbedTo: ["body"] })).toEqual(["paneWentAway"]);
    expect(missedOf({ ok: false, error: "pages wrote no report" })).toEqual(["pages wrote no report"]);
  });
});

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

  it("names the claims a harness printed as FAIL lines, as one-face prints them", () => {
    expect(missedClaims("ok   theFaceOffersNoSwitch\nFAIL choosingAnythingAtCityLandsAtNearbyAndStays\nFAIL noPageThrew\nwrote docs/one-face.json\n")).toEqual(["choosingAnythingAtCityLandsAtNearbyAndStays", "noPageThrew"]);
  });

  it("keeps the first look's verdict and frames beside the second's, and only that harness's", () => {
    const root = mkdtempSync(join(tmpdir(), "first-look-"));
    mkdirSync(join(root, "docs/one-face"), { recursive: true });
    mkdirSync(join(root, "docs/watch"), { recursive: true });
    mkdirSync(join(root, "docs/first-look/one-face"), { recursive: true });
    // An earlier run's first look of one-face, and a frame of it this run never wrote.
    writeFileSync(join(root, "docs/first-look/one-face/old-strip.png"), "earlier");
    const began = new Date(Date.now() - 1000).toISOString();
    const firstVerdict = { checks: { duringAPinchThatPansEveryBoardAndNameStaysFastenedToItsDistrictEveryFrame: { ok: false, held: [{ worst: 18.9 }] } }, ok: false };
    writeFileSync(join(root, "docs/one-face.json"), JSON.stringify(firstVerdict));
    writeFileSync(join(root, "docs/one-face/phone-dark.png"), "first look's strip");
    writeFileSync(join(root, "docs/watch/verify-one-face.json"), "{}");
    // Another harness's files, written at the same time beside it.
    writeFileSync(join(root, "docs/embed-one-face.json"), "{}");
    writeFileSync(join(root, "docs/one-face-elsewhere.json"), "{}");

    const kept = keepFirstLook(root, { name: "one-face", file: "verify-one-face.mjs", began });
    expect(kept.sort()).toEqual(["docs/first-look/one-face.json", "docs/first-look/one-face/phone-dark.png", "docs/first-look/watch/verify-one-face.json"]);
    expect(existsSync(join(root, "docs/first-look/one-face/old-strip.png"))).toBe(false);

    // The second look writes over its own paths, and the first stays beside it.
    writeFileSync(join(root, "docs/one-face.json"), JSON.stringify({ ok: true }));
    writeFileSync(join(root, "docs/one-face/phone-dark.png"), "second look's strip");
    expect(JSON.parse(readFileSync(join(root, "docs/first-look/one-face.json"), "utf8"))).toEqual(firstVerdict);
    expect(readFileSync(join(root, "docs/first-look/one-face/phone-dark.png"), "utf8")).toBe("first look's strip");
    expect(JSON.parse(readFileSync(join(root, "docs/one-face.json"), "utf8"))).toEqual({ ok: true });
  });

  it("keeps a part's first look, its watch with it, and leaves the first look of a part that failed before it", () => {
    const root = mkdtempSync(join(tmpdir(), "first-look-parts-"));
    mkdirSync(join(root, "docs/watch"), { recursive: true });
    const began = new Date(Date.now() - 1000).toISOString();
    for (const part of ["desk", "phone"]) {
      writeFileSync(join(root, `docs/one-face.part-${part}.json`), part);
      writeFileSync(join(root, `docs/watch/verify-one-face.part-${part}.json`), part);
    }
    const kept = (part: string) => keepFirstLook(root, { name: `one-face.${part}`, file: "verify-one-face.mjs", began }).sort();
    expect(kept("desk")).toEqual(["docs/first-look/one-face.part-desk.json", "docs/first-look/watch/verify-one-face.part-desk.json"]);
    expect(kept("phone")).toEqual(["docs/first-look/one-face.part-phone.json", "docs/first-look/watch/verify-one-face.part-phone.json"]);
    expect(readFileSync(join(root, "docs/first-look/one-face.part-desk.json"), "utf8")).toBe("desk");
  });

  it("keeps the first look of a harness whose verdict is named otherwise than its script (pages writes pages-face)", () => {
    const root = mkdtempSync(join(tmpdir(), "first-look-pages-"));
    mkdirSync(join(root, "docs"), { recursive: true });
    const began = new Date(Date.now() - 1000).toISOString();
    writeFileSync(join(root, "docs/pages-face.json"), JSON.stringify({ ok: false }));
    expect(keepFirstLook(root, { name: "pages", file: "verify-pages.mjs", began })).toEqual(["docs/first-look/pages-face.json"]);
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
