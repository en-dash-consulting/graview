import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { compileDocument } from "../../src/check.js";
import { appFromOrCompile } from "../../src/compiled.js";
import {
  appFrom,
  compileDocumentWithoutCheck,
  diffDocuments,
  editDocument,
  readDocument,
  RESPELLED,
  respellDocument,
  serializeCompiled,
  toDocument,
  type GraviewDocument,
} from "../../src/document/index.js";

/**
 * FR-134. A DOCUMENT AN OLDER BUILD WROTE KEEPS COMPILING.
 *
 * 0.1.16 spelled the framework in American English, and renamed a key a
 * document carries with it: a setting says `honored`, where every document
 * `toDocument` wrote before said `honoured`. Its notes said the document
 * format was unchanged. Graview Cloud's stored documents then failed to
 * compile, each setting "Nothing knows how to apply undefined".
 *
 * The fixtures are what older builds wrote, made by those builds from npm,
 * not by hand: `shortlist-0.1.10.gdd.json` is a declaration with the reader
 * settings that `@graview/core@0.1.10`'s `toDocument` exported, and
 * `shortlist-0.1.10.compiled-0.1.15.json` is that document as
 * `@graview/core@0.1.15`'s `serializeCompiled(compileDocument(…))` gave it
 * (FR-123). Neither is edited: they are history.
 */
const fixtures = new URL("./fixtures/", import.meta.url);
const read = (name: string): unknown => JSON.parse(readFileSync(new URL(name, fixtures), "utf8"));
const old = read("shortlist-0.1.10.gdd.json") as GraviewDocument;
const oldCompiled = read("shortlist-0.1.10.compiled-0.1.15.json") as { document: GraviewDocument; findings: unknown[] };

const spellings = (settings: readonly unknown[] | undefined) => (settings ?? []).map((setting) => Object.keys(setting as object).filter((key) => /^hono/.test(key)));

describe("a document an older build wrote", () => {
  it("is the one 0.1.10 wrote: its settings say honoured", () => {
    expect(spellings(old.settings)).toEqual([["honoured"], ["honoured"]]);
    expect(spellings(oldCompiled.document.settings)).toEqual([["honoured"], ["honoured"]]);
  });

  it("compiles on this build, checked, with no error, and its settings are honored", () => {
    const compiled = compileDocument(old);
    if (!compiled.ok) throw new Error(JSON.stringify(compiled.findings));
    expect(compiled.findings.filter((finding) => finding.severity === "error")).toEqual([]);
    expect(compiled.findings.map((finding) => finding.code)).not.toContain("check:setting-not-honorable");
    expect(compiled.app.settings?.map((setting) => [setting.name, setting.honored])).toEqual([
      ["text-size", "root-font-size"],
      ["motion", "root-attribute"],
    ]);
    expect(spellings(compiled.app.settings)).toEqual([["honored"], ["honored"]]);
  });

  it("is read as the current spelling, and the next save writes honored", () => {
    const readBack = readDocument(old);
    expect(readBack.findings).toEqual([]);
    expect(spellings(readBack.document?.settings)).toEqual([["honored"], ["honored"]]);

    const compiled = compileDocument(old);
    if (!compiled.ok) throw new Error("the 0.1.10 document should compile");
    expect(spellings(compiled.document.settings)).toEqual([["honored"], ["honored"]]);
    const saved = toDocument(compiled.app).document;
    expect(spellings(saved.settings)).toEqual([["honored"], ["honored"]]);
    // What was saved compiles, and says what the old one said.
    const again = compileDocument(saved);
    if (!again.ok) throw new Error(JSON.stringify(again.findings));
    expect(again.app.settings).toEqual(compiled.app.settings);
  });

  it("is not changed in place: the stored document is the caller's", () => {
    const stored = structuredClone(old);
    compileDocument(stored);
    readDocument(stored);
    expect(stored).toEqual(old);
  });

  it("keeps the current spelling when it says both", () => {
    const both = structuredClone(old) as unknown as { settings: Record<string, unknown>[] };
    both.settings[0]!["honored"] = "root-attribute";
    const readBack = readDocument(both);
    expect(readBack.document?.settings?.[0]).toMatchObject({ honored: "root-attribute" });
    expect(spellings(readBack.document?.settings)).toEqual([["honored"], ["honored"]]);
  });

  it("is not a change when compared with what the next save writes", () => {
    const compiled = compileDocument(old);
    if (!compiled.ok) throw new Error("the 0.1.10 document should compile");
    const diff = diffDocuments(old, compiled.document);
    expect(diff.sentences).not.toContain("The app's settings change.");
    expect(diffDocuments(old, toDocument(compiled.app).document).sentences).not.toContain("The app's settings change.");
  });

  it("is edited into the current spelling", () => {
    const edited = editDocument(old, [{ op: "add-field", kind: "category", field: "notes", spec: { type: "string" } }]);
    if (!edited.ok) throw new Error(JSON.stringify(edited.findings));
    expect(spellings(edited.document.settings)).toEqual([["honored"], ["honored"]]);
    expect(edited.said.join(" ")).not.toMatch(/settings/);
  });
});

describe("a compiled app an older build made of it (FR-123)", () => {
  it("is built with its settings honored", () => {
    const built = appFrom(oldCompiled);
    if (!built.ok) throw new Error(JSON.stringify(built.findings));
    expect(built.app.settings?.map((setting) => setting.honored)).toEqual(["root-font-size", "root-attribute"]);
    expect(spellings(built.document.settings)).toEqual([["honored"], ["honored"]]);
    expect(spellings(toDocument(built.app).document.settings)).toEqual([["honored"], ["honored"]]);
  });

  it("is built, not compiled again, when handed beside the stored document it was made from", async () => {
    // A note only the handed compiled app carries: a page that compiled instead would not say it.
    const marked = { ...oldCompiled, findings: [...oldCompiled.findings, { severity: "note", code: "handed", path: "", message: "built from what the host handed" }] };
    const built = await appFromOrCompile({ compiled: marked, document: old });
    if (!built.ok) throw new Error(JSON.stringify(built.findings));
    expect(built.findings.map((finding) => finding.code)).toContain("handed");
    expect(built.app.settings?.map((setting) => setting.honored)).toEqual(["root-font-size", "root-attribute"]);
  });

  it("is built when this build compiled it, handed beside the document as stored in the older spelling", async () => {
    const compiled = compileDocument(old);
    if (!compiled.ok) throw new Error("the 0.1.10 document should compile");
    const wire = JSON.parse(JSON.stringify(serializeCompiled(compiled))) as { findings: unknown[] };
    const marked = { ...wire, findings: [...wire.findings, { severity: "note", code: "handed", path: "", message: "built from what the host handed" }] };
    const built = await appFromOrCompile({ compiled: marked, document: JSON.stringify(old) });
    if (!built.ok) throw new Error(JSON.stringify(built.findings));
    expect(built.findings.map((finding) => finding.code)).toContain("handed");
    expect(built.app.settings?.map((setting) => setting.honored)).toEqual(["root-font-size", "root-attribute"]);
  });

  it("compiles in the page, without one, as before", async () => {
    const built = await appFromOrCompile({ document: old });
    if (!built.ok) throw new Error(JSON.stringify(built.findings));
    expect(built.app.settings?.map((setting) => setting.honored)).toEqual(["root-font-size", "root-attribute"]);
    expect(compileDocumentWithoutCheck(old).ok).toBe(true);
  });
});

describe("the keys respelled within a format", () => {
  it("name 0.1.16's one, settings[].honoured read as honored, and 0.1.17's, pages.overview read as pages.scene", () => {
    expect(RESPELLED).toEqual([
      { where: "settings[]", was: "honoured", now: "honored", since: "0.1.16" },
      { where: "pages", was: "overview", now: "scene", since: "0.1.17" },
    ]);
    expect(respellDocument({ pages: { overview: "The farm", first: "home" } }).document).toEqual({ pages: { scene: "The farm", first: "home" } });
  });

  it("say which they respelled, and leave a document in the current spelling as it is", () => {
    const respelled = respellDocument(old);
    expect(respelled.respelled).toEqual(["settings.0.honoured", "settings.1.honoured"]);
    const current = respelled.document;
    const again = respellDocument(current);
    expect(again.respelled).toEqual([]);
    expect(again.document).toBe(current);
    for (const odd of [null, undefined, "text", 3, [], { settings: "none" }, { settings: [null, 2, "x"] }]) expect(respellDocument(odd).document).toBe(odd);
  });
});

/*
 * THE CORPUS. Every document an older build wrote, named for the build
 * (`<name>-<version>.gdd.json`), compiles on this one without an error. A
 * change that renames a key a document carries fails here, on the document
 * that carried it, and its fix is a line in RESPELLED (upgrade.ts) — or a new
 * format version with an upgrade step — never an edit to the fixture.
 */
describe("every document an older build wrote", () => {
  const older = readdirSync(fixtures).filter((file) => /-\d+\.\d+\.\d+\.gdd\.json$/.test(file));

  it("is in the corpus", () => {
    expect(older).toContain("shortlist-0.1.10.gdd.json");
  });

  for (const file of older) {
    it(`compiles on this build: ${file}`, () => {
      const compiled = compileDocument(read(file));
      expect(compiled.findings.filter((finding) => finding.severity === "error")).toEqual([]);
      expect(compiled.ok).toBe(true);
    });
  }
});
