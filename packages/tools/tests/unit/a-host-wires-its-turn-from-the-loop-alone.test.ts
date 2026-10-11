import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * A HOST WIRES ITS TURN FROM THE LOOP ALONE (FR-161). `turnThroughMessages`
 * is forty bytes of wiring in a host's shell; reached through the package's
 * root it brought the agent, the providers and the rest (84 KB in Graview
 * Cloud's shell). `@graview/tools/turn` is the loop and nothing else.
 */
const require = createRequire(import.meta.url);
const { buildSync } = require("esbuild") as typeof import("esbuild");

describe("a host wires its turn from the loop alone", () => {
  const manifest = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")) as { exports: Record<string, { types: string; default: string }> };

  it("is an entry of its own: @graview/tools/turn", () => {
    expect(manifest.exports["./turn"]).toEqual({ types: "./dist/turn.d.ts", default: "./dist/turn.js" });
  });

  it("carries only the loop: bundled as a host's shell would, it reads one module and weighs under 2 KB", () => {
    const built = buildSync({
      stdin: { contents: `import { turnThroughMessages } from "./turn.ts"; export const turn = turnThroughMessages(async () => ({ content: [] }));`, resolveDir: fileURLToPath(new URL("../../src/", import.meta.url)), loader: "ts" },
      bundle: true,
      minify: true,
      format: "esm",
      write: false,
      metafile: true,
    });
    expect(Object.keys(built.metafile.inputs).filter((input) => input !== "<stdin>").map((input) => input.split("/").pop())).toEqual(["turn.ts"]);
    expect(built.outputFiles[0]!.contents.byteLength).toBeLessThan(2_000);
  });
});
