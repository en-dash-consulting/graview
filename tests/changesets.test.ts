import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

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
