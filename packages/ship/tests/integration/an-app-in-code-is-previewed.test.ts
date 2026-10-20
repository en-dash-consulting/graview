import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { loadApp } from "@graview/core/cli";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bundleAppForPage, NO_BUNDLER } from "../../src/preview-app.js";
import { PREVIEW_APP_PATH, servePreview, type Preview } from "../../src/serve-preview.js";
import { shotsOf } from "../../src/shots.js";

/**
 * AN APP DECLARED IN CODE IS PREVIEWED (W-245, the thirteenth walk, a
 * camera-trap survey). `graview shots` and `graview preview` took a JSON
 * document only — "a declaration document (a .json file) is required" — so
 * the survey, declared in code, could picture its contact sheet, a view
 * proposed and not kept, only over a document written for the purpose. Now
 * both take the app module `graview check` takes: the store runs the app as
 * Node loaded it, and the page is handed the module bundled for a browser,
 * at `/graview/app.js`, in place of a document.
 */
const entry = new URL("../../../guest/tests/fixtures/survey/app.mjs", import.meta.url).pathname;
const seed = JSON.parse(readFileSync(new URL("../../../guest/tests/fixtures/survey/seed.json", import.meta.url), "utf8"));
const draftView = { manifest: { name: "glance", title: "Stations at a glance", attach: "station", cardinality: "many" }, source: "graview.render('drawn');" };

let page: string;
let bundle: string;
let preview: Preview;
beforeAll(async () => {
  page = mkdtempSync(join(tmpdir(), "graview-preview-page-"));
  writeFileSync(join(page, "index.html"), "<!doctype html><title>the page</title>");
  bundle = await bundleAppForPage(entry);
  preview = await servePreview({ code: { app: await loadApp(entry), bundle }, seed, page, draftView });
}, 60_000);
afterAll(async () => {
  await preview.close();
  rmSync(page, { recursive: true, force: true });
});

describe("an app declared in code, previewed", () => {
  it("is bundled for the page as one module whose app is the module's own", async () => {
    const at = join(page, "bundled.mjs");
    writeFileSync(at, bundle);
    const { app } = (await import(pathToFileURL(at).href)) as { app: { name: string; schema: { kinds: readonly string[] } } };
    expect(app.name).toBe("Survey");
    expect([...app.schema.kinds]).toEqual(["station", "detection"]);
    expect(bundle).not.toMatch(/from\s*["']@graview\//);
  });

  it("hands the page where its module is, in place of a document, and serves the module there", async () => {
    const handed = (await (await fetch(`${preview.url}/graview/document`)).json()) as { module?: string; document?: unknown; compiled?: unknown; draftView?: unknown; state?: unknown };
    expect(handed.module).toBe(PREVIEW_APP_PATH);
    expect(handed.document).toBeUndefined();
    expect(handed.compiled).toBeUndefined();
    expect(handed.draftView).toEqual(draftView);
    expect(handed.state).toBeDefined();
    const served = await fetch(`${preview.url}${PREVIEW_APP_PATH}`);
    expect(served.headers.get("content-type")).toContain("text/javascript");
    expect(await served.text()).toBe(bundle);
  });

  it("runs the store over the app as Node loaded it, seeded", () => {
    expect(preview.app.name).toBe("Survey");
    expect(preview.served.store.graph.allNodes().length).toBe(seed.nodes.length);
  });

  it("pictures its places and the draft's, by title", () => {
    const asked = shotsOf(preview.app, ["Stations", "Stations at a glance"], ["pages"], draftView.manifest);
    expect(asked.unknown).toEqual([]);
    expect(asked.shots.map((shot) => shot.address)).toEqual(["/stations", "/places/stations-at-a-glance"]);
  });

  it("says how to get esbuild where there is none to bundle it with", async () => {
    await expect(bundleAppForPage(entry, { bundler: null })).rejects.toThrow(NO_BUNDLER);
  });
});
