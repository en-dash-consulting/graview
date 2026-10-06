import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { createSchema, defineApp, defineNode, z } from "../../src/index.js";
import { compileDocumentWithoutCheck, type GraviewDocument } from "../../src/document/index.js";
import { sceneDistricts, sceneThumbnail, toIso, villageCap } from "../../src/scene.js";

/*
 * FR-107. At a card's size, 264 × 132, the faithful thumbnail keeps each
 * plot the size its count gives it on a map whose blocks are five cells
 * apart, so a seeded template is a few specks on bare ground. Fitted to
 * what stands (`fit: "content"`), every district fills its whole block on
 * the same corner, the picture is cropped to the plots and what stands on
 * them, and a district stands a few blocks no narrower than `minBuilding`
 * pixels — one per member up to five — rather than one tiny building per
 * record. Held here on Graview Cloud's twelve templates with their seeds'
 * counts, measured from the SVG string itself, with no DOM.
 */
interface Template {
  readonly id: string;
  readonly counts: Record<string, number>;
  readonly document: GraviewDocument;
}
const templates = JSON.parse(readFileSync(resolve(import.meta.dirname, "fixtures/cloud-templates.json"), "utf8")) as Template[];
/** The fitted picture with its defaults: what a host listing apps asks for. */
const FITTED = { fit: "content" } as const;

interface Box {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}
const boxOf = (points: readonly (readonly [number, number])[]): Box => ({
  minX: Math.min(...points.map((p) => p[0])),
  maxX: Math.max(...points.map((p) => p[0])),
  minY: Math.min(...points.map((p) => p[1])),
  maxY: Math.max(...points.map((p) => p[1])),
});

/** The picture as a reader sees it at its own size: every plot and every roof in CSS pixels, from the viewBox and preserveAspectRatio meet. */
function measure(svg: string) {
  const width = Number(svg.match(/ width="([\d.]+)"/)![1]);
  const height = Number(svg.match(/ height="([\d.]+)"/)![1]);
  const [vx, vy, vw, vh] = svg.match(/viewBox="([^"]+)"/)![1]!.split(" ").map(Number) as [number, number, number, number];
  const scale = Math.min(width / vw, height / vh);
  const ox = (width - vw * scale) / 2;
  const oy = (height - vh * scale) / 2;
  const px = ([x, y]: readonly [number, number]): [number, number] => [ox + (x - vx) * scale, oy + (y - vy) * scale];
  const plots = [...svg.matchAll(/<g data-kind="([^"]+)">.*?points="([^"]+)"/g)].map((m) => ({
    kind: m[1]!,
    box: boxOf(m[2]!.split(" ").map((p) => px(p.split(",").map(Number) as [number, number]))),
  }));
  /* A roof is the one stroked face of a block: a path from its back corner, then relative steps to the right, front and left corners. */
  const roofs = [...svg.matchAll(/<path fill="#[0-9a-f]{6}" stroke="#[0-9a-f]{6}" d="M(-?[\d.]+) (-?[\d.]+)l(-?[\d.]+) (-?[\d.]+)l(-?[\d.]+) (-?[\d.]+)l(-?[\d.]+) (-?[\d.]+)z"/g)].map((m) => {
    const n = m.slice(1, 9).map(Number);
    const back: [number, number] = [n[0]!, n[1]!];
    const right: [number, number] = [back[0] + n[2]!, back[1] + n[3]!];
    const front: [number, number] = [right[0] + n[4]!, right[1] + n[5]!];
    const left: [number, number] = [front[0] + n[6]!, front[1] + n[7]!];
    return boxOf([back, right, front, left].map(px));
  });
  /* Everything drawn: plots, and every face of every block. */
  const reach: [number, number][] = plots.flatMap((p) => [
    [p.box.minX, p.box.minY],
    [p.box.maxX, p.box.maxY],
  ]);
  for (const m of svg.matchAll(/<path [^>]*d="M(-?[\d.]+) (-?[\d.]+)((?:[lv][^"z]*)+)z"/g)) {
    let x = Number(m[1]);
    let y = Number(m[2]);
    reach.push(px([x, y]));
    for (const step of m[3]!.matchAll(/([lv])(-?[\d.]+)(?: (-?[\d.]+))?/g)) {
      if (step[1] === "v") y += Number(step[2]);
      else {
        x += Number(step[2]);
        y += Number(step[3]);
      }
      reach.push(px([x, y]));
    }
  }
  const drawn = boxOf(reach);
  return { width, height, scale, plots, roofs, drawn, fill: ((drawn.maxX - drawn.minX) * (drawn.maxY - drawn.minY)) / (width * height) };
}

const appOf = (document: GraviewDocument) => {
  const compiled = compileDocumentWithoutCheck(document);
  if (!compiled.ok) throw new Error(compiled.findings.map((f) => f.message).join("; "));
  return compiled.app;
};

describe("a thumbnail fitted to what stands (FR-107)", () => {
  it("has Graview Cloud's twelve templates and their seeds to hold it to", () => {
    expect(templates.map((t) => t.id)).toHaveLength(12);
    for (const t of templates) expect(Object.keys(t.counts).length, t.id).toBeGreaterThan(0);
  });

  for (const t of templates) {
    it(`draws every district of ${t.id} plainly at 264 × 132: a plot at least 80 px wide, every building at least 16 px, the drawing filling at least 60% of the tile`, () => {
      const svg = sceneThumbnail(t.document, { counts: t.counts, ...FITTED });
      const m = measure(svg);
      expect(m.plots.map((p) => p.kind).sort()).toEqual(Object.keys(t.document.kinds).sort());
      for (const plot of m.plots) {
        expect(plot.box.maxX - plot.box.minX, `${t.id}: ${plot.kind}`).toBeGreaterThanOrEqual(80);
        // Inside the tile: nothing cropped off.
        expect(plot.box.minX).toBeGreaterThanOrEqual(0);
        expect(plot.box.maxX).toBeLessThanOrEqual(m.width);
        // At least one block stands on every district.
        expect(m.roofs.some((r) => (r.minX + r.maxX) / 2 > plot.box.minX && (r.minX + r.maxX) / 2 < plot.box.maxX && r.maxY <= plot.box.maxY), `${t.id}: ${plot.kind} stands nothing`).toBe(true);
      }
      for (const roof of m.roofs) expect(roof.maxX - roof.minX, t.id).toBeGreaterThanOrEqual(16);
      expect(m.drawn.minX).toBeGreaterThanOrEqual(0);
      expect(m.drawn.minY).toBeGreaterThanOrEqual(0);
      expect(m.drawn.maxX).toBeLessThanOrEqual(m.width + 0.5);
      expect(m.drawn.maxY).toBeLessThanOrEqual(m.height + 0.5);
      expect(m.fill, t.id).toBeGreaterThanOrEqual(0.6);
    });
  }

  it("is plainer than the faithful picture on every template: its narrowest district half as wide again, its narrowest building twice, and it fills more of the tile", () => {
    for (const t of templates) {
      const faithful = measure(sceneThumbnail(t.document, { counts: t.counts }));
      const fitted = measure(sceneThumbnail(t.document, { counts: t.counts, ...FITTED }));
      const narrowest = (m: ReturnType<typeof measure>) => Math.min(...m.plots.map((p) => p.box.maxX - p.box.minX));
      const thinnest = (m: ReturnType<typeof measure>) => Math.min(...m.roofs.map((r) => r.maxX - r.minX));
      expect(narrowest(fitted), t.id).toBeGreaterThanOrEqual(1.5 * narrowest(faithful));
      expect(thinnest(fitted), t.id).toBeGreaterThanOrEqual(2 * thinnest(faithful));
      expect(fitted.fill, t.id).toBeGreaterThan(faithful.fill);
    }
  });

  it("keeps the map's corners: each district's plot starts where the Scene's does, on the same lattice, in the Scene's order and hue", () => {
    for (const t of templates) {
      const districts = sceneDistricts(appOf(t.document), { counts: t.counts });
      const svg = sceneThumbnail(t.document, { counts: t.counts, ...FITTED });
      expect([...svg.matchAll(/data-kind="([^"]+)"/g)].map((m) => m[1]), t.id).toEqual(districts.map((d) => d.kind));
      for (const district of districts) {
        const back = toIso(district.plot.col, district.plot.row, 40);
        const corners = svg.match(new RegExp(`data-kind="${district.kind}">.*?points="([^"]+)"`))![1]!.split(" ")[0];
        expect(corners, `${t.id}: ${district.kind}`).toBe(`${back.x},${back.y}`);
      }
    }
  });

  it("stands one block per member up to five, and five taller blocks for more, rather than one tiny building per record", () => {
    // A four-kind template at a tile's size: candidates vary, the other three districts hold one each.
    const hiring = templates.find((t) => t.id === "hiring-loop")!.document;
    const others = { interviewer: 1, interview: 1, feedback: 1 };
    const roofs = (candidate: number) => measure(sceneThumbnail(hiring, { counts: { ...others, candidate }, ...FITTED })).roofs.length;
    expect(roofs(0)).toBe(3 + 1);
    expect(roofs(1)).toBe(3 + 1);
    expect(roofs(3)).toBe(3 + 3);
    expect(roofs(5)).toBe(3 + 5);
    expect(roofs(400)).toBe(3 + 5);
    const tallest = (candidate: number) => Math.max(...[...sceneThumbnail(hiring, { counts: { ...others, candidate }, ...FITTED }).matchAll(/v(\d+)/g)].map((m) => Number(m[1])));
    expect(tallest(400)).toBeGreaterThan(tallest(5));
  });

  it("stands the Scene's village on a lone district a tile can show it on, one building per member", () => {
    const vendor = defineNode("vendor", { fields: z.object({ label: z.string() }) });
    const app = defineApp({ name: "Vendors", schema: createSchema([vendor]) });
    const m = measure(sceneThumbnail(app, { counts: { vendor: 400 }, ...FITTED }));
    expect(m.roofs).toHaveLength(villageCap(4));
    for (const roof of m.roofs) expect(roof.maxX - roof.minX).toBeGreaterThanOrEqual(16);
  });

  it("stands the Scene's village, one building per member, when the picture is big enough for each to be minBuilding wide", () => {
    const vendor = defineNode("vendor", { fields: z.object({ label: z.string() }) });
    const app = defineApp({ name: "Vendors", schema: createSchema([vendor]) });
    const big = measure(sceneThumbnail(app, { counts: { vendor: 12 }, fit: "content", width: 1200, height: 600 }));
    expect(big.roofs).toHaveLength(12);
    for (const roof of big.roofs) expect(roof.maxX - roof.minX).toBeGreaterThanOrEqual(16);
    // Asked for buildings half as wide again as the village's, the same picture stands five, each at least that wide.
    const wider = 1.5 * Math.min(...big.roofs.map((r) => r.maxX - r.minX));
    const five = measure(sceneThumbnail(app, { counts: { vendor: 12 }, fit: "content", width: 1200, height: 600, minBuilding: wider }));
    expect(five.roofs).toHaveLength(5);
    for (const roof of five.roofs) expect(roof.maxX - roof.minX).toBeGreaterThanOrEqual(wider);
  });

  it("stands one block for a district when even five would be narrower than minBuilding", () => {
    const kinds = Array.from({ length: 12 }, (_, i) => defineNode(`kind${String(i).padStart(2, "0")}`, { fields: z.object({ label: z.string() }) }));
    const twelve = defineApp({ name: "Twelve", schema: createSchema(kinds as never) });
    const counts = Object.fromEntries(kinds.map((k) => [k.kind, 40]));
    // Twelve full districts on a tile, asked for 12 px buildings, stand five blocks each, every one at least that wide.
    const five = measure(sceneThumbnail(twelve, { counts, fit: "content", minBuilding: 12 }));
    expect(five.roofs).toHaveLength(12 * 5);
    for (const roof of five.roofs) expect(roof.maxX - roof.minX).toBeGreaterThanOrEqual(12);
    // Asked for buildings wider than five can be, each district stands one, at least that wide.
    const wider = 1.2 * Math.max(...five.roofs.map((r) => r.maxX - r.minX));
    const m = measure(sceneThumbnail(twelve, { counts, fit: "content", minBuilding: wider }));
    expect(m.plots).toHaveLength(12);
    expect(m.roofs).toHaveLength(12);
    for (const roof of m.roofs) expect(roof.maxX - roof.minX).toBeGreaterThanOrEqual(wider);
  });

  it("is the same string for the same document and options, every time, and for the document's JSON", () => {
    for (const t of templates) {
      const a = sceneThumbnail(t.document, { counts: t.counts, ...FITTED });
      expect(sceneThumbnail(t.document, { counts: t.counts, ...FITTED })).toBe(a);
      expect(sceneThumbnail(JSON.stringify(t.document), { counts: t.counts, ...FITTED })).toBe(a);
    }
  });

  it("leaves today's picture byte for byte as it was unless fit or minBuilding is asked for", () => {
    for (const t of templates) {
      const faithful = sceneThumbnail(t.document, { counts: t.counts });
      expect(sceneThumbnail(t.document, { counts: t.counts, fit: "map" })).toBe(faithful);
      expect(sceneThumbnail(t.document, { counts: t.counts, fit: "map", minBuilding: 4 })).toBe(faithful);
    }
  });

  it("escapes a tenant's words and draws nothing outside itself, fitted as faithful", () => {
    const hostile = {
      format: "graview-document",
      formatVersion: 1,
      name: `<script>alert("name")</script> & ]]>`,
      kinds: {
        task: { plural: `<img src=x onerror=alert(1)>`, fields: { label: { type: "string", required: true } }, edges: { "owned-by": { to: ["person"] } } },
        person: { plural: `]]><![CDATA[x`, fields: { name: { type: "string", required: true } } },
      },
    } as unknown as GraviewDocument;
    const svg = sceneThumbnail(hostile, { counts: { task: 3 }, ...FITTED });
    const tags = new Set([...svg.matchAll(/<\/?([A-Za-z!?][^\s/>]*)/g)].map((m) => m[1]));
    expect([...tags].sort()).toEqual(["g", "path", "polygon", "rect", "svg", "title"]);
    expect(svg).not.toContain("<script");
    expect(svg).not.toContain("<img");
    expect(svg).not.toContain("]]>");
    expect(svg).toContain("&lt;img src=x onerror=alert(1)&gt;: 3");
    expect(svg.replace('xmlns="http://www.w3.org/2000/svg"', "")).not.toMatch(/href|url\(|https?:|@import|<style|<script|<[^>]*\son[a-z]+=/i);
  });

  it("stays small: all twelve templates fitted, in both schemes, under 48 KB together and none over 2.5 KB", () => {
    let total = 0;
    for (const scheme of ["light", "dark"] as const) {
      for (const t of templates) {
        const bytes = new TextEncoder().encode(sceneThumbnail(t.document, { counts: t.counts, scheme, ...FITTED })).length;
        expect(bytes, `${t.id} ${scheme}`).toBeLessThan(2.5 * 1024);
        total += bytes;
      }
    }
    expect(total).toBeLessThan(48 * 1024);
  });

  it("draws an app with no kinds, and one that does not compile, as it did", () => {
    const empty = defineApp({ name: "Nothing yet", schema: createSchema([]) });
    expect(sceneThumbnail(empty, FITTED)).toContain("<title>Nothing yet: no kinds yet</title>");
    expect(sceneThumbnail("not json", FITTED)).toContain("this declaration does not compile");
  });

  it("runs here with no DOM", () => {
    expect(typeof (globalThis as { document?: unknown }).document).toBe("undefined");
    expect(typeof (globalThis as { window?: unknown }).window).toBe("undefined");
  });
});
