import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { GraviewDocument } from "../../src/document/index.js";
import { sceneThumbnail } from "../../src/scene.js";

/*
 * FR-120. Cloud has no per-kind counts for a live app's tile, and fitted to
 * what stands with no counts every district stood one block in its middle:
 * twelve apps, twelve rows of the same block. Without counts each district
 * now stands three, placed and raised by its kind's name, so a tile reads
 * as a place — the same map as the counted picture (corners, sizes, hues),
 * with other buildings on it. Measured from the SVG string, on Graview
 * Cloud's twelve templates, at a card's size.
 */
interface Template {
  readonly id: string;
  readonly counts: Record<string, number>;
  readonly document: GraviewDocument;
}
const templates = JSON.parse(readFileSync(resolve(import.meta.dirname, "fixtures/cloud-templates.json"), "utf8")) as Template[];
const TILE = { fit: "content", width: 264, height: 132 } as const;

/** Each district's plot as written: its kind, its four corners in the drawing's own units, and its fill. */
const plotsOf = (svg: string) =>
  [...svg.matchAll(/<g data-kind="([^"]+)"><title>[^<]*<\/title><polygon fill="(#[0-9a-f]{6})" stroke="#[0-9a-f]{6}" points="([^"]+)"/g)].map((m) => ({
    kind: m[1]!,
    fill: m[2]!,
    corners: m[3]!.split(" ").map((p) => p.split(",").map(Number) as [number, number]),
  }));

/** Every roof as written: the back corner, then the diamond, in the drawing's units. Its centre and its height off the ground (the wall's drop). */
function roofsOf(svg: string) {
  const walls = [...svg.matchAll(/d="M(-?[\d.]+) (-?[\d.]+)l(-?[\d.]+) (-?[\d.]+)v(\d+)/g)].map((m) => Number(m[5]));
  const roofs = [...svg.matchAll(/<path fill="#[0-9a-f]{6}" stroke="#[0-9a-f]{6}" d="M(-?[\d.]+) (-?[\d.]+)l(-?[\d.]+) (-?[\d.]+)l(-?[\d.]+) (-?[\d.]+)l(-?[\d.]+) (-?[\d.]+)z"/g)].map((m) => {
    const n = m.slice(1, 9).map(Number);
    const xs = [n[0]!, n[0]! + n[2]!, n[0]! + n[2]! + n[4]!, n[0]! + n[2]! + n[4]! + n[6]!];
    const ys = [n[1]!, n[1]! + n[3]!, n[1]! + n[3]! + n[5]!, n[1]! + n[3]! + n[5]! + n[7]!];
    return { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2, width: Math.max(...xs) - Math.min(...xs) };
  });
  // Two walls per block, drawn before its roof: the second wall's drop is the block's height.
  return roofs.map((roof, i) => ({ ...roof, rise: walls[i * 2 + 1] ?? 0 }));
}

/** Whether a point in the drawing's units falls inside a plot's diamond. */
function inside(point: { x: number; y: number }, corners: readonly (readonly [number, number])[]): boolean {
  const [back, right, front, left] = corners as [[number, number], [number, number], [number, number], [number, number]];
  const cx = (back[0] + front[0]) / 2;
  const cy = (back[1] + front[1]) / 2;
  const hw = (right[0] - left[0]) / 2;
  const hh = (front[1] - back[1]) / 2;
  return Math.abs(point.x - cx) / hw + Math.abs(point.y - cy) / hh <= 1;
}

/** Which plot each roof stands on: its foot is a rise below its centre. */
const districtsOf = (svg: string) => {
  const plots = plotsOf(svg);
  const roofs = roofsOf(svg);
  return plots.map((plot) => ({ ...plot, roofs: roofs.filter((roof) => inside({ x: roof.x, y: roof.y + roof.rise }, plot.corners)) }));
};

const sha = (text: string) => createHash("sha256").update(text).digest("hex").slice(0, 16);

describe("a thumbnail with no counts reads as a place (FR-120)", () => {
  it("stands three blocks on every district of every template, each one on its own district, rather than one", () => {
    for (const t of templates) {
      const svg = sceneThumbnail(t.document, TILE);
      const districts = districtsOf(svg);
      expect(districts.map((d) => d.kind).sort(), t.id).toEqual(Object.keys(t.document.kinds).sort());
      expect(roofsOf(svg), t.id).toHaveLength(3 * districts.length);
      for (const district of districts) expect(district.roofs, `${t.id}: ${district.kind}`).toHaveLength(3);
    }
  });

  it("draws each template's map as its counted picture does: the same plots, corner for corner, in the same hues and order", () => {
    for (const t of templates) {
      const counted = plotsOf(sceneThumbnail(t.document, { ...TILE, counts: t.counts }));
      const uncounted = plotsOf(sceneThumbnail(t.document, TILE));
      expect(uncounted, t.id).toEqual(counted);
    }
  });

  it("frames the picture as the counted one is framed, give or take a building's height: the view box within a fifth", () => {
    const box = (svg: string) => svg.match(/viewBox="([^"]+)"/)![1]!.split(" ").map(Number);
    for (const t of templates) {
      const [, , cw, ch] = box(sceneThumbnail(t.document, { ...TILE, counts: t.counts }));
      const [, , uw, uh] = box(sceneThumbnail(t.document, TILE));
      expect(Math.abs(uw! - cw!) / cw!, t.id).toBeLessThan(0.2);
      expect(Math.abs(uh! - ch!) / ch!, t.id).toBeLessThan(0.2);
    }
  });

  it("keeps every block readable at a tile's size: at least 16 px wide, and the drawing inside the tile", () => {
    for (const t of templates) {
      const svg = sceneThumbnail(t.document, TILE);
      const [, , vw, vh] = svg.match(/viewBox="([^"]+)"/)![1]!.split(" ").map(Number) as [number, number, number, number];
      const scale = Math.min(264 / vw, 132 / vh);
      for (const roof of roofsOf(svg)) expect(roof.width * scale, t.id).toBeGreaterThanOrEqual(16);
    }
  });

  it("stands the districts of one app differently, by their kinds' names: no two districts stand the same three blocks", () => {
    for (const t of templates) {
      const districts = districtsOf(sceneThumbnail(t.document, TILE));
      /* Where each block stands on its plot, and how tall: relative to the plot's back corner, so the district's own arrangement. */
      const arrangement = (d: (typeof districts)[number]) =>
        d.roofs.map((r) => `${Math.round(r.x - d.corners[0]![0])},${Math.round(r.y + r.rise - d.corners[0]![1])},${r.rise}`).sort().join(" ");
      const seen = districts.map(arrangement);
      expect(new Set(seen).size, `${t.id}: ${seen.join(" | ")}`).toBe(districts.length);
    }
  });

  it("does not draw two templates alike: every pair differs in its districts, where they stand or their hues", () => {
    const pictures = templates.map((t) => ({ id: t.id, plots: JSON.stringify(plotsOf(sceneThumbnail(t.document, TILE)).map((p) => [p.corners[0], p.fill])) }));
    for (let a = 0; a < pictures.length; a++) {
      for (let b = a + 1; b < pictures.length; b++) expect(pictures[a]!.plots, `${pictures[a]!.id} and ${pictures[b]!.id}`).not.toBe(pictures[b]!.plots);
    }
    // And the blocks themselves: no two templates' pictures are the same string with the hues taken out.
    const shapes = new Set(templates.map((t) => sceneThumbnail(t.document, TILE).replace(/#[0-9a-f]{6}/g, "#").replace(/<title>[^<]*<\/title>/g, "")));
    expect(shapes.size).toBe(templates.length);
  });

  it("is the same picture every time, from the document or its JSON, in both schemes", () => {
    for (const t of templates) {
      for (const scheme of ["light", "dark"] as const) {
        const a = sceneThumbnail(t.document, { ...TILE, scheme });
        expect(sceneThumbnail(t.document, { ...TILE, scheme })).toBe(a);
        expect(sceneThumbnail(JSON.stringify(t.document), { ...TILE, scheme })).toBe(a);
      }
    }
  });

  it("leaves the picture as it was when counts are given, a count of nothing included: one low block on an empty district", () => {
    const hiring = templates.find((t) => t.id === "hiring-loop")!;
    const zero = Object.fromEntries(Object.keys(hiring.document.kinds).map((kind) => [kind, 0]));
    const districts = districtsOf(sceneThumbnail(hiring.document, { ...TILE, counts: zero }));
    for (const district of districts) expect(district.roofs, district.kind).toHaveLength(1);
  });

  it("leaves every other picture byte for byte as it was: the map with and without counts, and the fitted picture with counts", () => {
    const all = (options: (t: Template) => Parameters<typeof sceneThumbnail>[1]) =>
      sha(templates.flatMap((t) => (["light", "dark"] as const).map((scheme) => sceneThumbnail(t.document, { scheme, ...options(t) }))).join("\n"));
    expect(all(() => ({}))).toBe("d66c5c012cfeda1a");
    expect(all((t) => ({ counts: t.counts }))).toBe("aa5a4b1fd2adfc3b");
    expect(all((t) => ({ counts: t.counts, fit: "content" }))).toBe("8961f4c2fb3e3672");
  });
});
