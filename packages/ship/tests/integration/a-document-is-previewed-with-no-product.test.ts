import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { previewPrincipal, servePreview, type Preview } from "../../src/serve-preview.js";
import { seatHeaders } from "../../src/remote.js";
import { findPlaywright, NO_PLAYWRIGHT, shotsOf } from "../../src/shots.js";

/**
 * `graview serve` is the store and draws nothing, so a stranger holding a
 * document and a snapshot had no way to look at them without building a
 * product (n-dx's face was that product). `graview preview` serves the
 * store and, beside it, Graview's own page: the document and the app
 * compiled from it at `/graview/document`, the page at every other address
 * so a place can be linked, and the store's own routes untouched.
 */
const ORG = JSON.parse(readFileSync(new URL("../../../core/tests/document/fixtures/org.gdd.json", import.meta.url), "utf8")) as { roles?: string[]; name: string };
const ORG_SEED = JSON.parse(readFileSync(new URL("../../../core/tests/document/fixtures/org.seed.json", import.meta.url), "utf8"));

let page: string;
let preview: Preview;
beforeAll(async () => {
  page = mkdtempSync(join(tmpdir(), "graview-preview-page-"));
  writeFileSync(join(page, "index.html"), "<!doctype html><title>the page</title>");
  writeFileSync(join(page, "page.js"), "window.__page = true;");
  preview = await servePreview({ document: ORG, seed: ORG_SEED, page });
});
afterAll(async () => {
  await preview.close();
  rmSync(page, { recursive: true, force: true });
});

describe("a document previewed with no product", () => {
  it("hands the page the document, the app compiled from it and the seat it sits in", async () => {
    const handed = (await (await fetch(`${preview.url}/graview/document`)).json()) as { document: { name: string }; compiled: { document: unknown }; principal: { roles?: string[] } };
    expect(handed.document.name).toBe(ORG.name);
    expect(handed.compiled.document).toBeDefined();
    expect(handed.principal.roles).toEqual(ORG.roles);
  });

  it("serves the page at any address that is not a file, so a place can be linked and reloaded, and its files as themselves", async () => {
    for (const path of ["/", "/places/overview", "/people/p1"]) {
      const answered = await fetch(`${preview.url}${path}`);
      expect(answered.headers.get("content-type")).toContain("text/html");
      expect(await answered.text()).toContain("the page");
    }
    const script = await fetch(`${preview.url}/page.js`);
    expect(script.headers.get("content-type")).toContain("text/javascript");
    expect(await (await fetch(`${preview.url}/../../etc/passwd.js`)).text()).toContain("the page");
  });

  it("leaves the store's own routes to the store, seeded", async () => {
    const state = (await (await fetch(`${preview.url}/graview/state`, { headers: seatHeaders(preview.principal) })).json()) as { snapshot: { nodes: unknown[] } };
    expect(state.snapshot.nodes.length).toBe(ORG_SEED.nodes.length);
  });

  it("refuses a document that does not compile, saying why, and a page that was never built", async () => {
    await expect(servePreview({ document: { format: "graview-document", formatVersion: 1, name: "Broken", kinds: { task: { fields: { done: { type: "nope" } } } } }, page })).rejects.toThrow(/does not compile/);
    await expect(servePreview({ document: ORG, page: join(page, "nowhere") })).rejects.toThrow(/preview page is not at/);
  });

  it("sits as a person holding every role the document declares, unless told who", () => {
    expect(previewPrincipal({ roles: ["owner", "viewer"] })).toMatchObject({ kind: "human", roles: ["owner", "viewer"] });
    expect(previewPrincipal({ roles: ["owner", "viewer"] }, { as: "ada", roles: ["viewer"] })).toMatchObject({ id: "ada", roles: ["viewer"] });
  });
});

describe("the places graview shots photographs", () => {
  it("are every place by default, the overview once as the scene, and a place by its address word, its title or a path", () => {
    const all = shotsOf(preview.app, [], ["pages"]).shots;
    expect(all.map((shot) => shot.name)).toEqual(expect.arrayContaining(["home", "overview", "people"]));
    expect(all.filter((shot) => shot.scene).map((shot) => shot.address)).toEqual(["/places/overview"]);
    const asked = shotsOf(preview.app, ["People", "/people/p1"], ["pages", "scene"]);
    expect(asked.unknown).toEqual([]);
    expect(asked.shots.map((shot) => [shot.name, shot.address])).toEqual([
      ["people", "/people"],
      ["people-scene", "/places/overview#focus=aggregate:person"],
      ["people-p1", "/people/p1"],
    ]);
    expect(shotsOf(preview.app, ["nowhere"], ["pages"]).unknown).toEqual(["nowhere"]);
  });
});

describe("graview shots without Playwright", () => {
  it("finds none in a project that has not installed it, and says how to install it rather than failing on an import", async () => {
    const empty = mkdtempSync(join(tmpdir(), "graview-no-playwright-"));
    try {
      writeFileSync(join(empty, "package.json"), "{}");
      expect(await findPlaywright(empty, [])).toBeNull();
      expect(NO_PLAYWRIGHT).toContain("npm install --save-dev playwright");
      expect(NO_PLAYWRIGHT).toContain("npx playwright install chromium");
    } finally {
      rmSync(empty, { recursive: true, force: true });
    }
  });

  it("finds it in a project that has", async () => {
    expect(await findPlaywright(process.cwd(), [])).not.toBeNull();
  });
});
