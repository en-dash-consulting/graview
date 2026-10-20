import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { request } from "node:http";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { previewPrincipal, servePreview, type Preview } from "../../src/serve-preview.js";
import { gunzipSync } from "node:zlib";
import { openRemote, seatHeaders, type RemoteState } from "../../src/remote.js";
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

  it("hands a view proposed and not kept with the document, and hands none unless asked (FR-187)", async () => {
    const plain = (await (await fetch(`${preview.url}/graview/document`)).json()) as { draftView?: unknown };
    expect(plain.draftView).toBeUndefined();
    const draftView = { manifest: { name: "front", attach: "home", cardinality: "many" }, source: "graview.render('drawn');" };
    const drafted = await servePreview({ document: ORG, seed: ORG_SEED, page, draftView });
    try {
      const handed = (await (await fetch(`${drafted.url}/graview/document`)).json()) as { draftView?: unknown };
      expect(handed.draftView).toEqual(draftView);
    } finally {
      await drafted.close();
    }
  });

  it("hands the store's state with the document, as this seat would be answered it, and a store opened on it asks for no state of its own", async () => {
    const handed = (await (await fetch(`${preview.url}/graview/document`)).json()) as { state: RemoteState; compiled: unknown };
    const asked = (await (await fetch(`${preview.url}/graview/state`, { headers: seatHeaders(preview.principal) })).json()) as RemoteState;
    expect(handed.state.snapshot.nodes.length).toBe(ORG_SEED.nodes.length);
    expect(handed.state.version).toBe(asked.version);
    const paths: string[] = [];
    const counting: typeof fetch = (input, init) => {
      paths.push(new URL(String(input)).pathname);
      return fetch(input, init);
    };
    const remote = await openRemote({ app: preview.app, url: preview.url, principal: preview.principal, pollMs: 0, fetch: counting, state: handed.state });
    expect(paths).not.toContain("/graview/state");
    expect(remote.store.graph.allNodes().length).toBe(ORG_SEED.nodes.length);
    remote.close();
  });

  it("sends its answers gzipped to a browser that takes them, and as written to one that does not", async () => {
    const asked = (headers: Record<string, string>) =>
      new Promise<{ encoding: string | undefined; length: number; body: Buffer }>((resolve, reject) => {
        const one = request(`${preview.url}/graview/document`, { headers }, (answer) => {
          const chunks: Buffer[] = [];
          answer.on("data", (chunk: Buffer) => chunks.push(chunk));
          answer.on("end", () => resolve({ encoding: answer.headers["content-encoding"], length: Number(answer.headers["content-length"]), body: Buffer.concat(chunks) }));
        });
        one.on("error", reject);
        one.end();
      });
    const zipped = await asked({ "accept-encoding": "gzip, deflate, br" });
    const plain = await asked({});
    expect(zipped.encoding).toBe("gzip");
    expect(plain.encoding).toBeUndefined();
    expect(zipped.length).toBe(zipped.body.length);
    expect(zipped.length).toBeLessThan(plain.length / 2);
    expect(JSON.parse(gunzipSync(zipped.body).toString("utf8")).document.name).toBe(ORG.name);
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

  it("answers only its own page on this machine: not another site's, and not one that rebinds its name here", async () => {
    const knock = (headers: Record<string, string>, path = "/graview/state", method = "GET") =>
      new Promise<number>((resolve, reject) => {
        const asked = request(`${preview.url}${path}`, { method, headers: { ...seatHeaders(preview.principal), ...headers } }, (answer) => {
          answer.resume();
          resolve(answer.statusCode ?? 0);
        });
        asked.on("error", reject);
        asked.end();
      });
    const port = new URL(preview.url).port;
    expect(await knock({})).toBe(200);
    expect(await knock({ origin: preview.url })).toBe(200);
    expect(await knock({ origin: "https://elsewhere.example" })).toBe(403);
    expect(await knock({ "sec-fetch-site": "cross-site" })).toBe(403);
    expect(await knock({ host: `evil.example:${port}`, origin: `http://evil.example:${port}` })).toBe(403);
    expect(await knock({ host: `evil.example:${port}` }, "/graview/document")).toBe(403);
  });

  it("will not believe seat headers on an address other machines reach, unless told the network is trusted", async () => {
    await expect(servePreview({ document: ORG, page, host: "0.0.0.0" })).rejects.toThrow(/seat/);
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

  it("take a draft view's place by its title, as a kept view's, and list it among the places (W-243)", () => {
    const draft = { name: "people-sheet", title: "People sheet", attach: "person", cardinality: "one" };
    const asked = shotsOf(preview.app, ["People sheet"], ["pages"], draft);
    expect(asked.unknown).toEqual([]);
    expect(asked.shots.map((shot) => [shot.name, shot.address])).toEqual([["people-sheet", "/places/people-sheet"]]);
    expect(shotsOf(preview.app, ["people-sheet"], ["pages"], draft).shots.map((shot) => shot.address)).toEqual(["/places/people-sheet"]);
    expect(shotsOf(preview.app, [], ["pages"], draft).shots.map((shot) => shot.name)).toContain("people-sheet");
    expect(shotsOf(preview.app, ["People sheet"], ["pages"]).unknown).toEqual(["People sheet"]);
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
