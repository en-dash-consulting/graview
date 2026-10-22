import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { Store, type AnySchema, type GraviewApp, type Principal } from "../../src/index.js";
import { describePlace } from "../../src/describe.js";
import { diffDocuments, documentHash, editDocument, type GraviewDocument } from "../../src/document/index.js";
import { compileDocument } from "../../src/check.js";

/**
 * A BRAND MAY KEEP THE LINE UNDER THE NAME OFF THE HOME (Roadmap
 * f-home-subtitle-separate). `brand.subtitle: false` is the one key: the
 * home draws no line from the `description`, and the description stays
 * the document's and the brand's — what a listing and the name's hover
 * read. Left out, the line is drawn as it always was; it is never hidden
 * by default. That the routed home draws it or not is
 * `packages/pages/tests/unit/a-brand-may-keep-the-line-under-the-name-off-the-home.test.tsx`.
 */
const vendors = JSON.parse(readFileSync(new URL("./fixtures/vendors.gdd.json", import.meta.url), "utf8")) as GraviewDocument;
const kept = { ...vendors, brand: { ...vendors.brand, subtitle: false } } as GraviewDocument;
const owner: Principal = { kind: "human", id: "u:owner", roles: ["owner"] };
const compiled = (document: GraviewDocument) => {
  const outcome = compileDocument(document, { today: () => "2026-10-21" });
  if (!outcome.ok) throw new Error(JSON.stringify(outcome.findings));
  return outcome;
};

describe("brand.subtitle", () => {
  it("validates as false, and refuses anything else", () => {
    expect(compiled(kept).ok).toBe(true);
    for (const value of [true, "no", 0]) {
      const refused = compileDocument({ ...vendors, brand: { ...vendors.brand, subtitle: value } } as never, { today: () => "2026-10-21" });
      expect(refused.ok, String(value)).toBe(false);
    }
  });

  it("keeps the description the app's and the brand's line, marked not to be drawn on the home", () => {
    const app = compiled(kept).app;
    expect(app.brand?.subtitle).toBe(vendors.description);
    expect(app.brand?.subtitleDrawn).toBe(false);
    expect(compiled(vendors).app.brand?.subtitleDrawn).toBeUndefined();
  });

  it("leaves the home's masthead without the line, and with it when left out", () => {
    const masthead = (document: GraviewDocument) => {
      const { app } = compiled(document);
      const store = new Store<AnySchema>({ schema: app.schema as AnySchema, mutations: app.mutations ?? [], policy: app.policy! });
      const said = describePlace(store, owner, "home", { app: app as GraviewApp<AnySchema>, today: "2026-10-21" });
      if (!said.ok) throw new Error(said.error);
      return said.description.masthead;
    };
    expect(masthead(vendors)?.subtitle).toBe(vendors.description);
    expect(masthead(kept)?.subtitle).toBeUndefined();
  });

  it("is written by set-brand, said in words, and taken back by true", async () => {
    const off = editDocument(vendors, [{ op: "set-brand", subtitle: false }]);
    if (!off.ok) throw new Error(JSON.stringify(off.findings));
    expect(off.document.brand?.subtitle).toBe(false);
    expect(off.document.description).toBe(vendors.description);
    expect(off.said.join(" ")).toBe("The home draws no line under the app's name; the description stays the app's, in its listings.");
    expect(diffDocuments(vendors, off.document).sentences).toContain("The home draws no line under the app's name; the description stays the app's, in its listings.");
    expect(diffDocuments(vendors, off.document).breaking).toBe(false);
    const on = editDocument(off.document, [{ op: "set-brand", subtitle: true }]);
    if (!on.ok) throw new Error(JSON.stringify(on.findings));
    expect(on.said.join(" ")).toBe("The home draws the description as the line under the app's name.");
    expect(await documentHash(on.document)).toBe(await documentHash(vendors));
    const cleared = editDocument(off.document, [{ op: "set-brand", subtitle: null }]);
    if (!cleared.ok) throw new Error(JSON.stringify(cleared.findings));
    expect(await documentHash(cleared.document)).toBe(await documentHash(vendors));
  });
});
