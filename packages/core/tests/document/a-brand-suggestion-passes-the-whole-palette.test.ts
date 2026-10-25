import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { checkBrandContrast, colorsIn, contrast, groundProblem } from "../../src/index.js";
import { editDocument, type GraviewDocument } from "../../src/document/index.js";
import { compileDocument } from "../../src/check.js";
import { GROUND_PAIRS } from "../../src/theme/ground.js";
import { TEXT_PAIRS } from "../../src/theme/types.js";

/**
 * WHAT A BRAND REFUSAL SUGGESTS IS KEPT WHEN IT IS SENT BACK.
 *
 * Roadmap f-ground-suggestion-passes, from Graview Cloud on 0.1.54:
 * `set-brand { ground: { light: "#f4efe6", dark: "#9a9a94" } }` was refused
 * with a shade that "would pass", and that shade was refused in turn, for
 * faint ink on the cards: the shade had been judged against ink, muted ink
 * and the accent alone, while the compiled palette is held to every pair
 * (`checkBrandContrast`). A shade a refusal names passes everything
 * set-brand then judges, in both schemes.
 *
 * Roadmap f-dark-brand-accent: a black brand with the Steelers' gold was
 * refused, so the app took a darker gold it never chose. An accent is
 * judged on the ground it is actually drawn on — gold on black reads — and
 * a bright accent refused on paper is answered with a pair that passes.
 */
const vendors = JSON.parse(readFileSync(new URL("./fixtures/vendors.gdd.json", import.meta.url), "utf8")) as GraviewDocument;
const plain: GraviewDocument = { ...vendors };
delete (plain as { brand?: unknown }).brand;

/** The set-brand a refusal's fix says, parsed: the first JSON object in it. */
function fixOf(fix: string | undefined): { op: "set-brand" } & Record<string, unknown> {
  const first = fix?.match(/^\{"op": "set-brand".*?\}(?=$|, or )/)?.[0];
  if (!first) throw new Error(`no set-brand in the fix: ${fix}`);
  return JSON.parse(first) as { op: "set-brand" } & Record<string, unknown>;
}

/** What the compiled app's palette fails, as `graview check` measures it. */
function paletteFailures(document: GraviewDocument): string[] {
  const compiled = compileDocument(document);
  if (!compiled.ok) return ["did not compile"];
  return [
    ...compiled.findings.filter((f) => f.path.startsWith("brand")).map((f) => `${f.path}: ${f.message}`),
    ...checkBrandContrast(compiled.app.brand!.schemes!).map((f) => `${f.scheme}: ${f.ink} on ${f.on} is ${f.ratio}`),
  ];
}

describe("a ground a refusal names is kept when it is sent back", () => {
  it("takes the shade it named for Cloud's dark ground, and the compiled palette passes every pair", () => {
    const refused = editDocument(plain, [{ op: "set-brand", ground: { light: "#f4efe6", dark: "#9a9a94" } }]);
    expect(refused.ok).toBe(false);
    if (refused.ok) return;
    expect(refused.findings[0]!.message).toMatch(/^In the dark scheme, ink #eef0f6 on the ground #9a9a94 is 2\.4:1; 4\.5:1 is needed — #[0-9a-f]{6} would pass\.$/);
    const kept = editDocument(plain, [fixOf(refused.findings[0]!.fix)]);
    expect(kept.ok ? [] : kept.findings.map((f) => f.message)).toEqual([]);
    if (kept.ok) expect(paletteFailures(kept.document)).toEqual([]);
  });

  it("refuses the shade 0.1.54 named for it by the pair that fails, faint ink on a card, rather than keeping a palette the check fails", () => {
    const refused = groundProblem({ light: "#f4efe6", dark: "#343431" });
    expect(refused?.scheme).toBe("dark");
    expect(refused?.sentence).toMatch(/^In the dark scheme, faint ink #97a0b6 on a card \(#[0-9a-f]{6}\) on the ground #343431 is \d\.\d:1; 4\.5:1 is needed — #[0-9a-f]{6} would pass\.$/);
  });

  const lights = ["#9a9a94", "#d8d8d5", "#7a8a9a", "#c0a080", "#8fbc8f", "#5a6a7a", "#4a3020"];
  const darks = ["#9a9a94", "#343431", "#5a5f70", "#3a2a4a", "#606060", "#2b3a55", "#d0c0a0"];
  const accents = [undefined, "#a8456a", "#1d4ed8", "#0f6e5c"];
  const grounds = [...lights, ...darks.map((dark) => ({ light: "#f4efe6", dark })), ...lights.slice(0, 3).map((light, n) => ({ light, dark: darks[n]! }))];

  it("over a spread of light and dark grounds, with and without an accent, every shade named is kept and its palette passes", () => {
    const misses: string[] = [];
    let roundTrips = 0;
    for (const accent of accents) {
      const start = accent ? editDocument(plain, [{ op: "set-brand", accent }]) : { ok: true as const, document: plain };
      if (!start.ok) throw new Error(`the accent ${accent} is refused on paper`);
      for (const ground of grounds) {
        const sent = editDocument(start.document, [{ op: "set-brand", ground }]);
        const at = `${JSON.stringify(ground)} with ${accent ?? "no accent"}`;
        if (sent.ok) {
          const failing = paletteFailures(sent.document);
          if (failing.length > 0) misses.push(`${at} was kept, and its palette fails: ${failing.join("; ")}`);
          continue;
        }
        const fix = sent.findings[0]!.fix;
        if (!fix?.startsWith('{"op"')) continue;
        roundTrips++;
        const back = editDocument(start.document, [fixOf(fix)]);
        if (!back.ok) misses.push(`${at}: sent back ${fix}, refused again: ${back.findings[0]!.message}`);
        else {
          const failing = paletteFailures(back.document);
          if (failing.length > 0) misses.push(`${at}: sent back ${fix}, kept, and its palette fails: ${failing.join("; ")}`);
        }
      }
    }
    expect(misses).toEqual([]);
    expect(roundTrips).toBeGreaterThan(30);
  });
});

describe("an accent is judged on the ground it is drawn on", () => {
  const gold = "#FFB612";

  it("keeps a black brand with the Steelers' gold as given, and the compiled palette passes every pair", () => {
    for (const ground of ["#000000", { light: "#000000", dark: "#000000" }, { light: "#101010" }]) {
      const outcome = editDocument(plain, [{ op: "set-brand", accent: gold, ground }]);
      expect([JSON.stringify(ground), outcome.ok ? [] : outcome.findings.map((f) => f.message)]).toEqual([JSON.stringify(ground), []]);
      if (!outcome.ok) continue;
      expect(outcome.document.brand).toEqual({ accent: gold, ground });
      expect(paletteFailures(outcome.document)).toEqual([]);
      const compiled = compileDocument(outcome.document);
      if (!compiled.ok) continue;
      // Drawn as given in the light scheme, on the black page, in the ink that reads there.
      const light = compiled.app.brand!.schemes!.light;
      expect(colorsIn(light.accent)[0]).toMatchObject(colorsIn(gold)[0]!);
      expect(contrast(colorsIn(light.ink)[0]!, colorsIn(light.ground)[0]!)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("judges the gold on the black ground the app already stands on", () => {
    const black = editDocument(plain, [{ op: "set-brand", ground: "#000000" }]);
    expect(black.ok).toBe(true);
    if (!black.ok) return;
    const gilded = editDocument(black.document, [{ op: "set-brand", accent: gold }]);
    expect(gilded.ok ? gilded.said : gilded.findings.map((f) => f.message)).toEqual([`The app's accent color becomes ${gold}.`]);
  });

  it("answers the gold on paper with a darker shade and with the dark page it reads on, and either sent back is kept", () => {
    const refused = editDocument(plain, [{ op: "set-brand", accent: gold }]);
    expect(refused.ok).toBe(false);
    if (refused.ok) return;
    const fix = refused.findings[0]!.fix!;
    expect(fix).toMatch(/^\{"op": "set-brand", "accent": "#[0-9a-f]{6}"\}, or keep #FFB612 on a dark page: \{"op": "set-brand", "accent": "#FFB612", "ground": \{"light": "#[0-9a-f]{6}", "dark": "#[0-9a-f]{6}"\}\}$/);
    const [shade, pair] = fix.split(", or keep #FFB612 on a dark page: ");
    for (const sent of [shade!, pair!]) {
      const back = editDocument(plain, [JSON.parse(sent) as { op: "set-brand" }]);
      expect([sent, back.ok ? [] : back.findings.map((f) => f.message)]).toEqual([sent, []]);
      if (back.ok) expect(paletteFailures(back.document)).toEqual([]);
    }
  });

  it("is said the same by check of a document that holds the gold on paper", () => {
    const compiled = compileDocument({ ...plain, brand: { accent: gold } });
    const said = compiled.findings.filter((f) => f.path === "brand.accent");
    expect(said).toHaveLength(1);
    expect(said[0]!.fix).toMatch(/^say \{ "accent": "#[0-9a-f]{6}" \}, or keep #FFB612 on a dark page: say \{ "ground": \{ "light": "#[0-9a-f]{6}", "dark": "#[0-9a-f]{6}" \} \}$/);
  });

  it("still refuses a dark accent on a black page, with a lighter shade that reads there", () => {
    const outcome = editDocument(plain, [{ op: "set-brand", accent: "#1d2a6b", ground: "#000000" }]);
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.findings[0]!.message).toMatch(/^#1d2a6b text on #[0-9a-f]{6} is \d\.\d:1; 4\.5:1 is needed — #[0-9a-f]{6} would pass\.$/);
    const back = editDocument(plain, [{ ...fixOf(outcome.findings[0]!.fix), ground: "#000000" }]);
    expect(back.ok).toBe(true);
  });
});

describe("a ground is judged on the pairs the check holds a palette to", () => {
  it("names every pair of TEXT_PAIRS a ground's tokens enter, and no other, short of text on a filled accent", () => {
    const surfaces = new Set(["ground", "panel", "panelMuted", "panelWarning", "float", "bar"]);
    const fromCheck = TEXT_PAIRS.filter((pair) => surfaces.has(pair.on)).map((pair) => `${pair.ink} on ${pair.on} at ${pair.requires}`).sort();
    const judged = GROUND_PAIRS.flatMap(([ink, , on, requires]) => on.map((surface) => `${ink} on ${surface} at ${requires}`)).sort();
    expect(judged).toEqual(fromCheck);
  });
});
