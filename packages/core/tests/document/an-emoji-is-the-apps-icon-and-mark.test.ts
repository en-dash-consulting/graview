import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { checkApp } from "../../src/cli/check.js";
import { createSchema, defineApp, defineNode, emojiMark, emojiProblem, faviconHref, SCHEMES, z, type AnySchema, type Brand, type GraviewApp } from "../../src/index.js";
import { diffDocuments, editDocument, type GraviewDocument } from "../../src/document/index.js";
import { compileDocument } from "../../src/check.js";

/**
 * AN EMOJI AS THE APP'S TAB ICON (Roadmap f-emoji-favicon). An app may
 * name one standard emoji as its page icon — `favicon: { emoji: "🏡" }` —
 * and where it has no logo the emoji stands as its mark. One emoji as the
 * reader sees it: a skin tone, a joined sequence or a flag is one; two
 * emoji, letters or nothing are refused in words, wherever a brand is
 * judged — the document, `graview check`, and `set-brand`.
 */
const read = (name: string) => JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8"));
const vendors = read("vendors.gdd.json") as GraviewDocument;
const withBrand = (brand: Record<string, unknown>): GraviewDocument => ({ ...vendors, brand: { ...vendors.brand, ...brand } as GraviewDocument["brand"] });
const errors = (document: GraviewDocument) => {
  const result = compileDocument(document, { today: () => "2026-10-14" });
  return result.findings.filter((f) => f.severity === "error");
};

const ACCEPTED = ["🏡", "👩🏽‍🌾", "🇺🇸"] as const;
const REFUSED = [
  ["ab", /it is not an emoji/],
  ["🏡🏡", /it is 2 emoji, and a mark is one/],
  ["", /it is empty/],
] as const;

describe("an emoji is the app's icon, and its mark where it has no logo", () => {
  for (const emoji of ACCEPTED) {
    it(`accepts ${emoji} as one standard emoji, in the document and in set-brand`, () => {
      expect(emojiProblem(emoji)).toBeNull();
      expect(errors(withBrand({ favicon: { emoji } }))).toEqual([]);
      expect(editDocument(vendors, [{ op: "set-brand", favicon: { emoji } }]).ok).toBe(true);
    });
  }

  for (const [emoji, says] of REFUSED) {
    it(`refuses ${JSON.stringify(emoji)} with a sentence that says why, at brand.favicon.emoji`, () => {
      const found = errors(withBrand({ favicon: { emoji } }));
      expect(found.map((f) => `${f.code} at ${f.path}`)).toEqual(["brand-emoji at brand.favicon.emoji"]);
      expect(found[0]!.message).toMatch(/cannot be the app's icon, because/);
      expect(found[0]!.message).toMatch(says);
      const edited = editDocument(vendors, [{ op: "set-brand", favicon: { emoji } }]);
      expect(edited.ok).toBe(false);
      if (!edited.ok) expect(edited.findings.map((f) => `${f.code} at ${f.path}`)).toEqual(["brand-emoji at edits.0.favicon.emoji"]);
    });
  }

  it("set-brand says the emoji becomes the icon and the mark, and the preview of the change says the same", () => {
    const outcome = editDocument(vendors, [{ op: "set-brand", favicon: { emoji: "🏡" } }]);
    if (!outcome.ok) throw new Error(JSON.stringify(outcome.findings));
    const sentence = vendors.brand?.logo ? "The app's page icon becomes 🏡." : "The app's page icon and mark become 🏡.";
    expect(outcome.said).toContain(sentence);
    expect(diffDocuments(vendors, outcome.document).sentences).toContain(sentence);
  });

  it("graview check refuses a declared app's emoji that is not one emoji", () => {
    const thing = defineNode("thing", { fields: z.object({ name: z.string() }) });
    const app = defineApp({ name: "Things", schema: createSchema([thing]), brand: { name: "Things", schemes: SCHEMES as Brand["schemes"], favicon: { emoji: "🏡🏡" } } });
    const found = checkApp(app as GraviewApp<AnySchema>).findings.filter((f) => f.code === "brand-emoji");
    expect(found.map((f) => [f.where, f.message])).toEqual([["brand.favicon.emoji", '"🏡🏡" cannot be the app\'s icon, because it is 2 emoji, and a mark is one.']]);
  });

  it("is the page's icon as an SVG with the emoji as text, and stands as the mark only where there is no logo", () => {
    const brand = { favicon: { emoji: "🏡" } };
    expect(decodeURIComponent(faviconHref(brand)!)).toMatch(/^data:image\/svg\+xml,<svg [^>]*><text [^>]*>🏡<\/text><\/svg>$/);
    expect(faviconHref({ favicon: { emoji: "🏡🏡" } })).toBeUndefined();
    expect(emojiMark(brand)).toBe("🏡");
    expect(emojiMark({ ...brand, logo: "/graview/assets/logo.svg" })).toBeUndefined();
  });
});
