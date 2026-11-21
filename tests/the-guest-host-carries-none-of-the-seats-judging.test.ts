import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
// @ts-expect-error — a plain .mjs module, without types.
import { BUDGETS } from "../scripts/lib/bundle-budget.mjs";
// @ts-expect-error — a plain .mjs module, without types.
import { graviewSources } from "../scripts/lib/graview-sources.mjs";

/*
 * THE GUEST HOST CARRIES NONE OF THE SEAT'S JUDGING. Whether a list may
 * offer when each record was made and touched (`offersTouches`) and a store
 * marked as served (`markServed`) are asked by the guest host before any
 * worker is drawn; while they lived beside the seat's judging (`seen.ts`),
 * asking them brought the seat's judging and what it reads into what the
 * host page loads first, about 55 KB minified. They are read from
 * `served-touches.ts`, which judges nothing itself.
 */
const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const JUDGING = ["packages/core/src/seen.ts"];
const GUEST_HOST = ["the guest host, before a worker is drawn", "the guest host, registering a worker view", "the guest host, drawing a worker"];

async function modulesIn(entry: string): Promise<readonly string[]> {
  const esbuild = createRequire(join(repo, "package.json"))("esbuild");
  const result = await esbuild.build({
    stdin: { contents: entry, resolveDir: join(repo, "packages", "embed"), loader: "js" },
    bundle: true,
    splitting: true,
    outdir: "out",
    minify: true,
    format: "esm",
    platform: "browser",
    external: ["react", "react-dom", "react/jsx-runtime", "react-dom/client"],
    jsx: "automatic",
    define: { "process.env.NODE_ENV": '"production"' },
    plugins: [graviewSources(repo)],
    metafile: true,
    write: false,
    logLevel: "silent",
  });
  const kept = new Set<string>();
  for (const output of Object.values(result.metafile.outputs) as { inputs: Record<string, { bytesInOutput: number }> }[]) {
    for (const [input, { bytesInOutput }] of Object.entries(output.inputs)) if (bytesInOutput > 0) kept.add(input.replace(/^.*?(packages\/)/, "$1"));
  }
  return [...kept];
}

describe("the guest host", () => {
  it.each(GUEST_HOST)("%s carries none of the seat's judging", async (name) => {
    const budget = (BUDGETS as { name: string; entry: string }[]).find((one) => one.name === name)!;
    expect(budget, name).toBeDefined();
    const modules = await modulesIn(budget.entry);
    expect(modules).toContain("packages/core/src/served-touches.ts");
    expect(modules.filter((module) => JUDGING.includes(module))).toEqual([]);
  }, 60_000);
});
