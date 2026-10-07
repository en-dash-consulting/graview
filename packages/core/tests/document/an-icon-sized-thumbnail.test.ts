import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { GraviewDocument } from "../../src/document/index.js";
import { sceneDistricts, sceneThumbnail } from "../../src/scene.js";
import { compileDocumentWithoutCheck } from "../../src/document/index.js";

/*
 * AN ICON-SIZED THUMBNAIL (FR-130). Graview Cloud's tab showed every app as
 * the same cube in its accent: twelve tabs, twelve cubes. `size: "icon"`
 * draws the Scene from altitude at 32 × 32 — each district on its whole
 * block in its hue, one block standing on it, no streets, no edges — as a
 * standalone SVG a host can serve as a favicon. Measured from the SVG
 * string, on Cloud's twelve templates, at 16 and 32 pixels.
 */
interface Template {
  readonly id: string;
  readonly counts: Record<string, number>;
  readonly document: GraviewDocument;
}
const templates = JSON.parse(readFileSync(resolve(import.meta.dirname, "fixtures/cloud-templates.json"), "utf8")) as Template[];
const ICON = { size: "icon" } as const;
const sha = (text: string) => createHash("sha256").update(text).digest("hex").slice(0, 16);

type Pt = readonly [number, number];
/** Every polygon of a path as written, absolute: `M x y x y … z`. */
const polygonOf = (d: string): Pt[] => {
  const n = d.replace(/^M/, "").replace(/z$/, "").trim().split(/[ ,]+/).map(Number);
  const out: Pt[] = [];
  for (let i = 0; i < n.length; i += 2) out.push([n[i]!, n[i + 1]!]);
  return out;
};

/** Each district as written: its kind, its plot's diamond and fill, and the three faces of the block on it (left, right, roof). */
function districtsOf(svg: string) {
  return [...svg.matchAll(/<g data-kind="([^"]+)">(.*?)<\/g>/g)].map((m) => {
    const paths = [...m[2]!.matchAll(/<path fill="(#[0-9a-f]{6})" d="([^"]+)"\/>/g)].map((p) => ({ fill: p[1]!, points: polygonOf(p[2]!) }));
    const [plot, left, right, roof] = paths;
    return { kind: m[1]!, paths, plot: plot!, left: left!, right: right!, roof: roof! };
  });
}
const span = (points: readonly Pt[], axis: 0 | 1) => Math.max(...points.map((p) => p[axis])) - Math.min(...points.map((p) => p[axis]));
const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const distance = (a: string, b: string) => Math.hypot(...rgb(a).map((v, i) => v - rgb(b)[i]!));

describe("an icon-sized thumbnail (FR-130)", () => {
  it("is a standalone SVG of 32 by 32 with its own namespace, a favicon a host can serve as it is", () => {
    for (const t of templates) {
      const svg = sceneThumbnail(t.document, ICON);
      expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"'), t.id).toBe(true);
      expect(svg.endsWith("</svg>")).toBe(true);
      // One element per tag, every one closed: no text but the title, nothing outside itself.
      for (const tag of ["svg", "g", "title"]) expect(svg.split(`<${tag}`).length, `${t.id}: <${tag}>`).toBe(svg.split(`</${tag}>`).length);
      for (const tag of ["path", "rect"]) expect(svg.split(`<${tag} `).length, `${t.id}: <${tag}/>`).toBe(svg.split(new RegExp(`<${tag} [^>]*/>`)).length);
      expect(new Set([...svg.matchAll(/<(\w+)/g)].map((m) => m[1]))).toEqual(new Set(["svg", "title", "rect", "g", "path"]));
      expect(svg, t.id).not.toMatch(/href|url\(|<text|<image|<style|font/);
      // Named once, by the app: a tab or a screen reader reads its name, not an inventory.
      expect(svg.match(/<title>([^<]*)<\/title>/)?.[1], t.id).toBe(t.document.name);
    }
  });

  it("is small: under 1.5 KB for every template, in both schemes", () => {
    for (const t of templates) {
      for (const scheme of ["light", "dark"] as const) expect(sceneThumbnail(t.document, { ...ICON, scheme }).length, `${t.id} ${scheme}`).toBeLessThan(1536);
    }
  });

  it("draws every district as a plot in its hue with one block on it, and nothing else: no streets, no edges, no strokes", () => {
    for (const t of templates) {
      const svg = sceneThumbnail(t.document, ICON);
      const districts = districtsOf(svg);
      expect(districts.map((d) => d.kind).sort(), t.id).toEqual(Object.keys(t.document.kinds).sort());
      for (const district of districts) expect(district.paths, `${t.id}: ${district.kind}`).toHaveLength(4);
      expect(svg, t.id).not.toMatch(/stroke|<line|<polyline/);
      // The hues the Scene gives the kinds: each district's plot is its own color, and none is another's.
      const fills = districts.map((d) => d.plot.fill);
      expect(new Set(fills).size, t.id).toBe(fills.length);
    }
  });

  it("keeps every district visible at 16 px: its plot and its block at least 2 px across, its plot apart from the ground", () => {
    for (const t of templates) {
      for (const scheme of ["light", "dark"] as const) {
        const svg = sceneThumbnail(t.document, { ...ICON, scheme });
        const ground = svg.match(/<rect [^>]*fill="(#[0-9a-f]{6})"/)![1]!;
        for (const px of [16, 32]) {
          const scale = px / 32;
          for (const district of districtsOf(svg)) {
            const where = `${t.id} ${scheme} ${district.kind} at ${px} px`;
            // A diamond is half as tall as it is wide: its height is the narrow way to see it.
            expect(span(district.plot.points, 1) * scale, where).toBeGreaterThanOrEqual(2);
            expect(span(district.roof.points, 0) * scale, where).toBeGreaterThanOrEqual(2);
            expect(span(district.left.points, 1) * scale, where).toBeGreaterThanOrEqual(px === 16 ? 1 : 2);
            expect(distance(district.plot.fill, ground), where).toBeGreaterThan(24);
          }
        }
      }
    }
  });

  it("tells two apps apart at a glance: every pair of templates differs in its hues or in where its districts stand", () => {
    const glance = templates.map((t) => {
      const app = compileDocumentWithoutCheck(t.document);
      if (!app.ok) throw new Error(t.id);
      const districts = sceneDistricts(app.app);
      const svg = sceneThumbnail(t.document, ICON);
      return {
        id: t.id,
        hues: districts.map((d) => d.hue).sort((a, b) => a - b),
        // Where each plot stands in the icon, in whole pixels at 16 px.
        layout: districtsOf(svg).map((d) => d.plot.points.map(([x, y]) => `${Math.round(x / 2)},${Math.round(y / 2)}`).join(" ")).sort().join("|"),
      };
    });
    const hueApart = (a: readonly number[], b: readonly number[]) =>
      a.length !== b.length || a.some((hue, i) => Math.min(Math.abs(hue - b[i]!), 360 - Math.abs(hue - b[i]!)) >= 20);
    for (let a = 0; a < glance.length; a++) {
      for (let b = a + 1; b < glance.length; b++) {
        const one = glance[a]!;
        const other = glance[b]!;
        expect(hueApart(one.hues, other.hues) || one.layout !== other.layout, `${one.id} and ${other.id}`).toBe(true);
      }
    }
  });

  it("is the same icon every time, from the document, its JSON or the app, in both schemes; transparent when asked", () => {
    for (const t of templates) {
      for (const scheme of ["light", "dark"] as const) {
        const a = sceneThumbnail(t.document, { ...ICON, scheme });
        expect(sceneThumbnail(t.document, { ...ICON, scheme })).toBe(a);
        expect(sceneThumbnail(JSON.stringify(t.document), { ...ICON, scheme })).toBe(a);
        const compiled = compileDocumentWithoutCheck(t.document);
        if (compiled.ok) expect(sceneThumbnail(compiled.app, { ...ICON, scheme })).toBe(a);
      }
      expect(sceneThumbnail(t.document, { ...ICON, background: false })).not.toMatch(/<rect/);
    }
  });

  it("stands a counted district's block taller for more, on the same plot", () => {
    for (const t of templates) {
      const counted = districtsOf(sceneThumbnail(t.document, { ...ICON, counts: t.counts }));
      const uncounted = districtsOf(sceneThumbnail(t.document, ICON));
      expect(counted.map((d) => d.kind), t.id).toEqual(uncounted.map((d) => d.kind));
      // A block's height is its wall's drop, against its plot's width so the frame does not count.
      const rise = (d: (typeof counted)[number]) => (span(d.left.points, 1) - span(d.roof.points, 1) / 2) / span(d.plot.points, 0);
      counted.forEach((district, i) => {
        const more = (t.counts[district.kind] ?? 0) > 0;
        if (more) expect(rise(district), `${t.id}: ${district.kind}`).toBeGreaterThan(rise(uncounted[i]!));
      });
    }
  });

  it("draws a declaration that does not compile as empty ground, rather than throwing", () => {
    const svg = sceneThumbnail("{ not a document", ICON);
    expect(svg).toMatch(/^<svg xmlns="http:\/\/www.w3.org\/2000\/svg" width="32" height="32"/);
    expect(districtsOf(svg)).toEqual([]);
  });

  it("leaves every other picture byte for byte as it was", () => {
    const all = (options: (t: Template) => Parameters<typeof sceneThumbnail>[1]) =>
      sha(templates.flatMap((t) => (["light", "dark"] as const).map((scheme) => sceneThumbnail(t.document, { scheme, ...options(t) }))).join("\n"));
    expect(all(() => ({}))).toBe("d66c5c012cfeda1a");
    expect(all((t) => ({ counts: t.counts }))).toBe("aa5a4b1fd2adfc3b");
    expect(all((t) => ({ counts: t.counts, fit: "content" }))).toBe("8961f4c2fb3e3672");
    expect(all(() => ({ fit: "content", width: 264, height: 132 }))).toBe("a53529211d1b9905");
    expect(all(() => ({ width: 32, height: 32 }))).toBe("eb3314aaaf8b71e9");
    expect(all(() => ({ width: 32, height: 32, fit: "content" }))).toBe("da019a051493bd27");
  });
});
