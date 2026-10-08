import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { compileDocument } from "../../src/check.js";
import { editDocument, toDocument, type GraviewDocument } from "../../src/document/index.js";
import { sceneTitle } from "../../src/index.js";

/**
 * FR-134 AND FR-137: THE SCENE'S OLD WORD KEEPS WORKING EVERYWHERE IT WAS SAID.
 *
 * 0.1.15 and 0.1.16 wrote what the scene is called as `pages.overview`, at
 * most 40 characters, and `arrange-pages` took it as `overview`. 0.1.17 reads
 * the key as `pages.scene` (RESPELLED). A respelling that narrows what the
 * key may hold, or an edit vocabulary that refuses the word an older chat
 * sends, takes away what a stored document or a host's tool already says.
 */
const document = JSON.parse(readFileSync(new URL("./fixtures/every-lens.gdd.json", import.meta.url), "utf8")) as GraviewDocument;
const FORTY = "The whole of the hall, from far above it"; // 40 characters, as 0.1.16 took them

describe("a document 0.1.16 wrote with the scene's word", () => {
  it("compiles at any length 0.1.16 accepted, and the switch says it", () => {
    expect(FORTY).toHaveLength(40);
    const old = compileDocument({ ...document, pages: { ...document.pages, overview: FORTY } }, { today: () => "2026-09-01" });
    if (!old.ok) throw new Error(JSON.stringify(old.findings.filter((finding) => finding.severity === "error")));
    expect(sceneTitle(old.app.pages)).toBe(FORTY);
    expect(toDocument(old.app).document.pages).toMatchObject({ scene: FORTY });
  });

  it("is given back in the current spelling by an edit list that changes nothing, as by any other", () => {
    const stored = { ...document, pages: { ...document.pages, overview: "The hall" } } as GraviewDocument;
    const edited = editDocument(stored, []);
    if (!edited.ok) throw new Error(JSON.stringify(edited.findings));
    expect(edited.document.pages).toMatchObject({ scene: "The hall" });
    expect(edited.document.pages).not.toHaveProperty("overview");
    expect(stored.pages).toHaveProperty("overview", "The hall");
  });
});

describe("arrange-pages from a chat or a tool written before 0.1.17", () => {
  it("reads overview as the scene's word", () => {
    const edited = editDocument(document, [{ op: "arrange-pages", overview: "The hall" }]);
    if (!edited.ok) throw new Error(JSON.stringify(edited.findings));
    expect(edited.document.pages).toMatchObject({ scene: "The hall" });
    expect(edited.document.pages).not.toHaveProperty("overview");
    expect(edited.said.join(" ")).toMatch(/the switch calls the scene "The hall"/i);
  });

  it("keeps scene when it says both", () => {
    const edited = editDocument(document, [{ op: "arrange-pages", overview: "The hall", scene: "The floor" }]);
    if (!edited.ok) throw new Error(JSON.stringify(edited.findings));
    expect(edited.document.pages).toMatchObject({ scene: "The floor" });
  });
});

describe("the switch's two words", () => {
  const findings = (pages: Record<string, unknown>) =>
    compileDocument({ ...document, pages: { ...document.pages, ...pages } }, { today: () => "2026-09-01" }).findings.filter((finding) => finding.code === "check:pages-faces-alike");

  it("are warned of when they say the same, since the switch would offer one word twice", () => {
    expect(findings({ scene: "Lists", pages: "lists" }).map((finding) => [finding.path, finding.severity])).toEqual([["pages", "warning"]]);
    expect(findings({ scene: "Pages" })).toHaveLength(1);
    expect(findings({ scene: "The hall", pages: "Lists" })).toEqual([]);
    expect(findings({})).toEqual([]);
  });
});
