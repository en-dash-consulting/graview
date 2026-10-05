import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { createSchema, defineApp, defineNode, hueFor, isoShade, sceneDistricts, villageCap, z } from "../../src/index.js";
import { hsl } from "../../src/theme/contrast.js";
import { compileDocumentWithoutCheck, sceneThumbnail, type GraviewDocument } from "../../src/document/index.js";

/*
 * FR-74. A host listing apps draws each one as the Scene draws it from
 * altitude — its districts on the declaration's own map, in their hues,
 * lit as the Scene lights them — as one SVG string, with no DOM. The
 * district order and plots are held to the layout the Scene runs in
 * `packages/layout/tests/unit/a-thumbnail-is-the-scenes-city.test.ts`.
 */
const vendors = JSON.parse(readFileSync(resolve(import.meta.dirname, "fixtures/vendors.gdd.json"), "utf8")) as GraviewDocument;

const hostile = {
  format: "graview-document",
  formatVersion: 1,
  name: `<script>alert("name")</script> & ]]> 'quoted'`,
  kinds: {
    task: {
      noun: "task",
      plural: `<script>alert(1)</script>"tasks" & ]]>`,
      fields: { label: { type: "string", required: true } },
      edges: { "owned-by": { to: ["person"] } },
    },
    person: { plural: `]]><![CDATA[<img src=x onerror=alert(2)>`, fields: { name: { type: "string", required: true } } },
  },
} as unknown as GraviewDocument;

/** The tags a thumbnail is made of. Anything else in it is markup that got through. */
const TAGS = new Set(["svg", "title", "rect", "g", "polygon"]);
const tagsIn = (svg: string): string[] => [...svg.matchAll(/<\/?([A-Za-z!?][^\s/>]*)/g)].map((m) => m[1]!);

/** Every hex a hue's face is drawn in, in a scheme — what the Scene's `hsl(var(--graview-hue) S% L%)` resolves to. */
const faceHex = (hue: number, f: { saturation: number; lightness: number }) => {
  const c = hsl(hue, f.saturation / 100, f.lightness / 100);
  return `#${[c.r, c.g, c.b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
};

describe("a picture of an app without a browser", () => {
  it("is the same string for the same document, every time, and for its JSON", () => {
    const a = sceneThumbnail(vendors, { scheme: "light" });
    expect(sceneThumbnail(vendors, { scheme: "light" })).toBe(a);
    expect(sceneThumbnail(JSON.stringify(vendors), { scheme: "light" })).toBe(a);
    const compiled = compileDocumentWithoutCheck(vendors);
    if (!compiled.ok) throw new Error("vendors does not compile");
    expect(sceneThumbnail(compiled.app, { scheme: "light" })).toBe(a);
  });

  it("is a standalone SVG: a namespace, a viewBox, a size, an accessible name, and nothing outside itself", () => {
    const svg = sceneThumbnail(vendors);
    expect(svg).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="264" height="132" viewBox="-?[\d.]+ -?[\d.]+ [\d.]+ [\d.]+" preserveAspectRatio="xMidYMid meet" role="img"/);
    expect(svg).toContain("<title>Wedding vendors: 2 kinds, categories, vendors</title>");
    expect(svg.endsWith("</svg>")).toBe(true);
    for (const tag of tagsIn(svg)) expect(TAGS.has(tag), tag).toBe(true);
    expect(svg.replace('xmlns="http://www.w3.org/2000/svg"', "")).not.toMatch(/href|url\(|https?:|@import|<style|<script|on[a-z]+=/i);
  });

  it("escapes everything the document says, because a document is a tenant's words", () => {
    const svg = sceneThumbnail(hostile);
    for (const tag of tagsIn(svg)) expect(TAGS.has(tag), tag).toBe(true);
    expect(svg).not.toContain("<script");
    expect(svg).not.toContain("<img");
    expect(svg).not.toContain("]]>");
    expect(svg).not.toContain("<![CDATA[");
    expect(svg).toContain("&lt;script&gt;alert(&quot;name&quot;)&lt;/script&gt; &amp; ]]&gt; &#39;quoted&#39;");
    expect(svg).toContain("&lt;script&gt;alert(1)&lt;/script&gt;&quot;tasks&quot; &amp; ]]&gt;");
    expect(svg).toContain("]]&gt;&lt;![CDATA[&lt;img src=x onerror=alert(2)&gt;");
    // A title the host passes is escaped the same way.
    expect(sceneThumbnail(vendors, { title: `</title><script>x</script>` })).toContain("<title>&lt;/title&gt;&lt;script&gt;x&lt;/script&gt;</title>");
  });

  it("escapes a declared app's kind names too, which no document regex has held", () => {
    const odd = defineNode(`a"<b>&c` as "x", { fields: z.object({ label: z.string() }), plural: `<i>` });
    const svg = sceneThumbnail(defineApp({ name: "<app>", schema: createSchema([odd]) }));
    expect(svg).toContain('data-kind="a&quot;&lt;b&gt;&amp;c"');
    expect(svg).toContain("<title>&lt;i&gt;</title>");
    for (const tag of tagsIn(svg)) expect(TAGS.has(tag), tag).toBe(true);
  });

  it("lights each kind in its own hue as the Scene does, differently in each scheme", () => {
    for (const scheme of ["light", "dark"] as const) {
      const svg = sceneThumbnail(vendors, { scheme });
      const shade = isoShade(scheme);
      for (const kind of ["category", "vendor"]) {
        const hue = Math.round(hueFor(kind));
        expect(svg).toContain(`fill="${faceHex(hue, shade.roof)}"`);
        expect(svg).toContain(`fill="${faceHex(hue, shade.left)}"`);
        expect(svg).toContain(`fill="${faceHex(hue, shade.right)}"`);
        expect(svg).toContain(`fill="${faceHex(hue, shade.plot)}" stroke="${faceHex(hue, shade.plotEdge)}"`);
      }
      expect(svg).toContain(`<g fill-opacity="${shade.plot.alpha}" stroke-opacity="${shade.plotEdge.alpha}"`);
      expect(svg).toContain(`data-scheme="${scheme}"`);
    }
    expect(sceneThumbnail(vendors, { scheme: "light" })).not.toBe(sceneThumbnail(vendors, { scheme: "dark" }));
  });

  it("takes a brand's declared accent for a kind's hue, as the Scene does", () => {
    const thing = defineNode("thing", { fields: z.object({ label: z.string() }) });
    const plain = defineApp({ name: "Things", schema: createSchema([thing]) });
    const branded = defineApp({ ...plain, brand: { name: "Things", schemes: { light: undefined as never, dark: undefined as never }, accents: { thing: 140 } } as never });
    expect(sceneThumbnail(branded)).toContain(`fill="${faceHex(140, isoShade("light").roof)}"`);
    expect(sceneThumbnail(plain)).not.toContain(`fill="${faceHex(140, isoShade("light").roof)}"`);
  });

  it("stands a village on a district when the host passes counts, one building each up to what the plot holds", () => {
    // A block has one roof, and only a roof is stroked white in daylight.
    const blocks = (svg: string) => (svg.match(/stroke="#ffffff"/g) ?? []).length;
    expect(blocks(sceneThumbnail(vendors))).toBe(2);
    expect(blocks(sceneThumbnail(vendors, { counts: { vendor: 5 } }))).toBe(1 + 5);
    const cap = villageCap(4);
    expect(blocks(sceneThumbnail(vendors, { counts: { vendor: 500, category: 1 } }))).toBe(cap + 1);
    expect(sceneThumbnail(vendors, { counts: { vendor: 5 } })).toContain("<title>vendors: 5</title>");
    // Nonsense counts are no members, not a crash.
    expect(blocks(sceneThumbnail(vendors, { counts: { vendor: -3, category: Number.NaN } }))).toBe(2);
  });

  it("draws an empty app as a quiet ground, and a document that does not compile as one that says so", () => {
    const empty = sceneThumbnail(defineApp({ name: "Nothing yet", schema: createSchema([]) }));
    expect(empty).toContain("<title>Nothing yet: no kinds yet</title>");
    expect(empty).not.toContain("<polygon");
    const broken = sceneThumbnail({ format: "graview-document", formatVersion: 1, name: "<Broken>", kinds: {} } as unknown as GraviewDocument);
    expect(broken).toContain("<title>&lt;Broken&gt;: this declaration does not compile, so there is nothing to draw</title>");
    expect(sceneThumbnail("not json")).toContain("<title>An app: this declaration does not compile");
    expect(sceneThumbnail({} as GraviewDocument, { scheme: "dark", background: false })).not.toContain("<rect");
  });

  it("stays small for a large app: fifty kinds, populated, under 48 KB, and forty as a document under 16 KB", () => {
    const kinds = Array.from({ length: 50 }, (_, i) =>
      defineNode(`kind${String(i).padStart(2, "0")}`, {
        fields: z.object({ label: z.string() }),
        edges: i > 0 ? { near: { to: [`kind${String(i - 1).padStart(2, "0")}`] } } : {},
      }),
    );
    const big = defineApp({ name: "Big", schema: createSchema(kinds as never) });
    const counts = Object.fromEntries(kinds.map((k, i) => [k.kind, (i * 7) % 30]));
    const svg = sceneThumbnail(big, { counts });
    expect((svg.match(/data-kind=/g) ?? []).length).toBe(50);
    expect(svg.length).toBeLessThan(48 * 1024);
    expect(svg).toContain("<title>Big: 50 kinds, kind00s, kind01s, kind02s, kind03s, kind04s, kind05s and 44 more</title>");

    const document = {
      format: "graview-document",
      formatVersion: 1,
      name: "Forty",
      kinds: Object.fromEntries(Array.from({ length: 40 }, (_, i) => [`k${i}`, { fields: { name: { type: "string", required: true } } }])),
    } as unknown as GraviewDocument;
    expect(sceneThumbnail(document).length).toBeLessThan(16 * 1024);
  });

  it("is drawn in the Scene's district order, from the same map", () => {
    const compiled = compileDocumentWithoutCheck(vendors);
    if (!compiled.ok) throw new Error("vendors does not compile");
    const order = sceneDistricts(compiled.app).map((d) => d.kind);
    const drawn = [...sceneThumbnail(vendors).matchAll(/data-kind="([^"]+)"/g)].map((m) => m[1]);
    expect(drawn).toEqual(order);
  });

  it("is sized as asked and keeps the city's proportion rather than stretching it", () => {
    const svg = sceneThumbnail(vendors, { width: 400, height: 100 });
    const [, , w, h] = svg.match(/viewBox="([^"]+)"/)![1]!.split(" ").map(Number);
    expect(svg).toContain('width="400" height="100"');
    expect(w! / h!).toBeCloseTo(4, 1);
  });

  it("runs here with no DOM: the module reaches for no document or window", () => {
    expect(typeof (globalThis as { document?: unknown }).document).toBe("undefined");
    expect(typeof (globalThis as { window?: unknown }).window).toBe("undefined");
  });
});
