import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { LAYERS, SCENE_LAYERS } from "../packages/core/src/theme/layers.js";
import { themeCss } from "../packages/primitives/src/theme.js";

/**
 * ONE LADDER ORDERS EVERY SURFACE (FR-76).
 *
 * On a hosted app the profile opened under the seat's rail: each surface
 * had picked its own `z-index` in one stacking context, the profile 20 and
 * the rail 40. The ladder is written once (`packages/core/src/theme/layers.ts`)
 * and this reads every source file of every package for a number written
 * anywhere else — inline (`zIndex: 20`) or in a stylesheet (`z-index: 60`).
 */
const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const LADDER = "packages/core/src/theme/layers.ts";

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.(ts|tsx|css)$/.test(name) && !name.endsWith(".d.ts") ? [path] : [];
  });
}

describe("one ladder orders every surface", () => {
  it("leaves no z-index written as a number outside the ladder", () => {
    const packages = readdirSync(join(repo, "packages")).filter((name) => statSync(join(repo, "packages", name, "src"), { throwIfNoEntry: false })?.isDirectory());
    const raw: string[] = [];
    for (const name of packages) {
      for (const file of sources(join(repo, "packages", name, "src"))) {
        const at = relative(repo, file);
        if (at === LADDER) continue;
        readFileSync(file, "utf8")
          .split("\n")
          .forEach((line, index) => {
            // A number anywhere in the value (`20`, `open ? 11 : 10 - plane`): either way a rung of its own.
            if (/\bz-?index\s*:[^,;}\n]*\d/i.test(line)) raw.push(`${at}:${index + 1}: ${line.trim()}`);
          });
      }
    }
    expect(raw).toEqual([]);
  });

  it("climbs in the order the surfaces stand: scene, overview, rails, popovers, dialogs, toasts", () => {
    const order = ["scene", "overview", "rail", "popover", "dialog", "toast"] as const;
    expect(Object.keys(LAYERS)).toEqual([...order]);
    for (let at = 1; at < order.length; at++) expect(LAYERS[order[at]!]).toBeGreaterThan(LAYERS[order[at - 1]!]);
    // What is inside the scene stays inside it: its whole sub-ladder is under the first rung above it.
    expect(Math.max(...Object.values(SCENE_LAYERS))).toBeLessThan(LAYERS.overview + LAYERS.rail);
  });

  it("writes the ladder on the theme's root, and on an embed's box when scoped", () => {
    for (const css of [themeCss("light"), themeCss("dark", undefined, { scope: ".graview-embed-1" })]) {
      for (const [name, value] of Object.entries(LAYERS)) expect(css).toContain(`--graview-layer-${name}: ${value};`);
    }
    // Scoped, nothing is written on the host's root.
    expect(themeCss("dark", undefined, { scope: ".graview-embed-1" })).not.toMatch(/(^|\n):root\s*\{[^}]*--graview-layer/);
  });
});
