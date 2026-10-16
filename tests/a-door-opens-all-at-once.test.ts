import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
// @ts-expect-error — a plain .mjs module, without types.
import { doorsOpenAtOnce, preloadLinks } from "../scripts/lib/hosted-page.mjs";

/**
 * A DOOR OPENS ALL AT ONCE (the first load, 0.1.31). A page split into
 * chunks was fetched a level at a time: the browser read a chunk before it
 * learned the chunks it imports, so a lens on a phone's home arrived three
 * round trips after it was asked for. The page `graview preview` serves is
 * built with every `import()` naming the chunks its door needs, and its
 * head naming the entry's chunks and the opening face's.
 */
const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const esbuild = createRequire(join(repo, "packages/embed/package.json"))("esbuild");

let dir: string;
let built: { outputFiles: { path: string; contents: Uint8Array }[]; metafile: { outputs: Record<string, unknown> } };
beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "graview-doors-"));
  // A page that imports `shared` up front, and opens a door to `face`, which imports `deep` and `shared`; a second door shares `deep`.
  writeFileSync(join(dir, "page.js"), `import { shared } from "./shared.js"; export const open = () => import("./face.js"); export const other = () => import("./other.js"); console.log(shared);`);
  writeFileSync(join(dir, "shared.js"), `export const shared = "shared";`);
  writeFileSync(join(dir, "deep.js"), `export const deep = "deep";`);
  writeFileSync(join(dir, "face.js"), `import { deep } from "./deep.js"; import { shared } from "./shared.js"; export const face = deep + shared;`);
  writeFileSync(join(dir, "other.js"), `import { deep } from "./deep.js"; export const other = deep;`);
  built = await esbuild.build({ entryPoints: { page: join(dir, "page.js") }, bundle: true, splitting: true, format: "esm", outdir: join(dir, "out"), chunkNames: "chunk.[hash]", write: false, metafile: true, logLevel: "silent" });
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe("a built page", () => {
  it("names, as each door is asked for, every chunk the door imports, so they are fetched side by side", () => {
    const files = doorsOpenAtOnce(built.outputFiles, built.metafile) as { path: string; text: string }[];
    const page = files.find((file) => file.path.endsWith("page.js"))!;
    const outputs = built.metafile.outputs as Record<string, { entryPoint?: string; imports: { path: string; kind: string }[] }>;
    const faceChunk = Object.entries(outputs).find(([, output]) => output.entryPoint?.endsWith("face.js"))![0];
    const needs = outputs[faceChunk]!.imports.filter((one) => one.kind === "import-statement").map((one) => `./${one.path.split("/").pop()}`);
    expect(needs.length).toBeGreaterThan(0);
    const call = new RegExp(`__graviewPreload\\(import\\.meta\\.url,(\\[[^\\]]*\\])\\),import\\("\\./${faceChunk.split("/").pop()!.replace(/\./g, "\\.")}"\\)`).exec(page.text);
    expect(call, page.text).not.toBeNull();
    expect(JSON.parse(call![1]!).sort()).toEqual(needs.sort());
    expect(page.text.startsWith("var __graviewPreload=")).toBe(true);
  });

  it("leaves a file with no door as it was", () => {
    const files = doorsOpenAtOnce(built.outputFiles, built.metafile) as { path: string; text: string }[];
    for (const file of files.filter((one) => !one.path.endsWith("page.js"))) expect(file.text).not.toContain("__graviewPreload");
  });

  it("names in its head the chunks the entry imports, and the documents it fetches first", () => {
    const links = preloadLinks(built.metafile, { entry: "page.js", fetches: ["/graview/document"] }) as string;
    expect(links).toContain('<link rel="preload" href="/graview/document" as="fetch" crossorigin="anonymous">');
    const outputs = built.metafile.outputs as Record<string, { entryPoint?: string; imports: { path: string; kind: string }[] }>;
    const entry = Object.entries(outputs).find(([, output]) => output.entryPoint?.endsWith("page.js"))![1];
    for (const one of entry.imports.filter((one) => one.kind === "import-statement")) expect(links).toContain(`<link rel="modulepreload" href="/${one.path.split("/").pop()}">`);
    expect(links).not.toContain("page.js");
  });
});
