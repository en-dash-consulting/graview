import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
// @ts-expect-error — a plain .mjs module of the scripts, with no declarations.
import { saysCompatibility, surfacesTouched } from "../scripts/lib/surfaces.mjs";

/**
 * A CHANGESET NAMES ONLY WHAT IS PUBLISHED. The examples are in the
 * config's `ignore` list, and `changeset version` refuses a changeset that
 * mixes one with a published package ("Found mixed changeset") — which it
 * says only in the release job, after everything else has gone green. Two
 * did, and the release could not version at all. Asked here instead.
 */
const root = resolve(import.meta.dirname, "..");
const dir = resolve(root, ".changeset");
const config = JSON.parse(readFileSync(resolve(dir, "config.json"), "utf8")) as { ignore: string[] };

describe("the changesets", () => {
  it("never name an example app, which is never published", () => {
    const naming = readdirSync(dir)
      .filter((file) => file.endsWith(".md") && file !== "README.md")
      .flatMap((file) => {
        const head = readFileSync(resolve(dir, file), "utf8").split("---")[1] ?? "";
        return config.ignore.filter((name) => head.includes(`"${name}"`)).map((name) => `${file} names ${name}`);
      });
    expect(naming).toEqual([]);
  });
});

/** FR-30: a change to a surface a host holds the framework to says what it did, in every changeset. */
describe("the compatibility line", () => {
  it("knows which of the five surfaces a change touches", () => {
    expect(surfacesTouched(["packages/core/src/ops/types.ts", "packages/primitives/src/shell.tsx"])).toEqual(["ops and primitives"]);
    expect(surfacesTouched(["packages/ship/src/serve.ts", "packages/ship/src/export.ts"])).toEqual(["stored formats", "the wire"]);
    expect(surfacesTouched(["packages/core/src/cli/check/policy.ts"])).toEqual(["the declaration and check finding codes"]);
    expect(surfacesTouched(["packages/tools/src/agent/tools.ts"])).toEqual(["derived tool names and input schemas"]);
    expect(surfacesTouched(["packages/pages/src/router.tsx", "docs/site/index.html"])).toEqual([]);
  });

  it("reads the line in a changeset's body, not its front matter", () => {
    expect(saysCompatibility('---\n"@graview/core": patch\n---\n\nA thing.\n\nCompatibility: unchanged.\n')).toBe(true);
    expect(saysCompatibility('---\n"@graview/core": patch\n---\n\nA thing, and nothing about compatibility.\n')).toBe(false);
    expect(saysCompatibility('---\n"@graview/core": patch\n---\n\nCompatibility:\n')).toBe(false);
  });

  it("is said by every changeset waiting here that touches a surface", () => {
    // The ones written for FR items name a surface; each of them says what it did. Right after a
    // release none is waiting, and that holds too: the release run tests the tree it just versioned.
    const pending = readdirSync(dir).filter((file) => file.endsWith(".md") && file !== "README.md");
    const forItems = pending.filter((file) => /\(FR-\d+/.test(readFileSync(resolve(dir, file), "utf8")));
    for (const file of forItems) expect(saysCompatibility(readFileSync(resolve(dir, file), "utf8")), file).toBe(true);
  });
});
