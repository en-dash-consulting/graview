import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { counted, createSchema, defineNode, z } from "@graview/core";
import { describe, expect, it } from "vitest";

/**
 * A KIND IS COUNTED BY ITS NOUN. "1 test-drive" on a place card, "1
 * vehicle" in Find and on a district, "1 vehicle with no showroom" under a
 * coverage — five surfaces each spoke a count of one with the kind's id,
 * each written separately (the seventh walk, where the kind is "vehicle"
 * and its noun is "car"). One function says it now, and no source speaks a
 * kind's id as a word.
 */
const root = resolve(__dirname, "..");
const sources = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "node_modules" || name === "dist" ? [] : sources(path);
    return /\.(ts|tsx)$/.test(name) ? [path] : [];
  });

describe("a count of one kind", () => {
  it("says the noun for one and the plural for the rest", () => {
    const schema = createSchema([defineNode("vehicle", { noun: "car", fields: z.object({ label: z.string() }), plural: "Cars" }), defineNode("test-drive", { fields: z.object({ label: z.string() }), plural: "Test drives" })]);
    expect(counted(schema, "vehicle", 1)).toBe("1 car");
    expect(counted(schema, "vehicle", 3)).toBe("3 cars");
    expect(counted(schema, "test-drive", 1)).toBe("1 test drive");
  });

  it("is never said from a kind's id in the packages' sources (the scaffold, which writes words at create time, aside)", () => {
    const spoken: string[] = [];
    for (const dir of readdirSync(join(root, "packages"))) {
      const src = join(root, "packages", dir, "src");
      try {
        statSync(src);
      } catch {
        continue;
      }
      for (const file of sources(src)) {
        if (file.includes(`${"scaffold"}/`)) continue;
        readFileSync(file, "utf8").split("\n").forEach((line, at) => {
          if (/(?<!edge\.|connector\.)\bkind\)?\.replace\(\/-\/g, " "\)|=== 1 \? (?:of|kind|String\(kind\))\b/.test(line)) spoken.push(`${relative(root, file)}:${at + 1}`);
        });
      }
    }
    expect(spoken).toEqual([]);
  });
});
