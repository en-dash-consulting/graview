import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { checkApp, compileDocument } from "../../src/check.js";
import { describePlace } from "../../src/describe.js";
import { declaredLenses, Store, type AnySchema, type GraviewApp, type Principal } from "../../src/index.js";

/**
 * A GRID LENS ORDERS ITS ROWS, ITS COLUMNS AND ITS CARDS AS ASKED
 * (2026-10-15, The Beatles).
 *
 * "Releases by era" listed its releases in the order they were written. A
 * coverage takes `sort` for its rows and `columnSort` for its columns, and
 * a status board `sort` for its cards — a field, or { by, direction } — and
 * an order by a field the kind does not have is a warning by its path.
 */
const base = JSON.parse(readFileSync(new URL("./fixtures/beatles.gdd.json", import.meta.url), "utf8"));
const seed = JSON.parse(readFileSync(new URL("./fixtures/beatles.seed.json", import.meta.url), "utf8"));
const owner: Principal = { kind: "human", id: "u:owner", roles: ["owner"] };

function appWith(options: Record<string, unknown>, lens = 3) {
  const document = structuredClone(base);
  document.lenses[lens].options = options;
  const compiled = compileDocument(document, { today: () => "2026-10-15" });
  if (!compiled.ok) throw new Error(JSON.stringify(compiled.findings.filter((f) => f.severity === "error")));
  return compiled.app as GraviewApp<AnySchema>;
}
const said = (app: GraviewApp<AnySchema>, slug: string) => {
  const store = new Store<AnySchema>({ schema: app.schema as AnySchema, mutations: app.mutations ?? [], policy: app.policy!, snapshot: seed as never });
  const result = describePlace(store, owner, slug, { app, width: 1440, today: "2026-10-15" });
  if (!result.ok) throw new Error(result.error);
  return result.description.text;
};
const rowsOf = (text: string) => text.split("\n").filter((line) => /^[^-\s].*: (Beatlemania|The studio years|After the band)$/.test(line)).map((line) => line.split(":")[0]);

describe("a coverage's order", () => {
  it("lists its rows by the field it names, oldest first", () => {
    const rows = rowsOf(said(appWith({ sort: { by: "released" } }), "releases-by-era"));
    expect(rows.slice(0, 4)).toEqual(["Love Me Do", "Please Please Me", "With the Beatles", "A Hard Day's Night"]);
    expect(rows.at(-1)).toBe("Now and Then");
  });

  it("runs the other way when it says desc, and by the name when it says label", () => {
    expect(rowsOf(said(appWith({ sort: { by: "released", direction: "desc" } }), "releases-by-era"))[0]).toBe("Now and Then");
    expect(rowsOf(said(appWith({ sort: "label" }), "releases-by-era")).slice(0, 3)).toEqual(["1", "A Hard Day's Night", "Abbey Road"]);
  });

  it("orders its columns by the field columnSort names", () => {
    const text = said(appWith({ columnSort: { by: "began", direction: "desc" } }), "releases-by-era");
    expect(text).toContain("18 releases against 3 eras: After the band, The studio years, Beatlemania.");
  });

  it("warns, by its path, of an order by a field the kind does not have, and draws as written", () => {
    const app = appWith({ sort: { by: "year" }, columnSort: { by: "released" } });
    const findings = declaredLenses(app).findings.filter((finding) => finding.code === "lens-sort");
    expect(findings.map((finding) => finding.path)).toEqual(["lenses.3.options.sort", "lenses.3.options.columnSort"]);
    expect(findings[0]!.message).toContain('release has no field "year"');
    expect(findings[1]!.message).toContain('era has no field "released"');
    expect(checkApp(app).findings.some((finding) => finding.code.endsWith("lens-sort"))).toBe(true);
  });
});

describe("an order and a horizon, in the document's shape", () => {
  it("is typed: an order that is not a field or { by, direction } is refused by its path", () => {
    const document = structuredClone(base);
    document.lenses[3].options = { sort: { by: 5 } };
    const compiled = compileDocument(document);
    expect(compiled.ok).toBe(false);
    expect(compiled.ok ? [] : compiled.findings.filter((f) => f.severity === "error").map((f) => f.path)).toContain("lenses.3.options.sort");
  });
});

describe("a status board's order", () => {
  it("lists the cards in each column by the field it names", () => {
    const document = structuredClone(base);
    document.kinds.release.fields.format = { type: "enum", options: ["album", "single"] };
    document.lenses.push({ name: "columns", title: "Releases by format", bindings: { release: { column: "format" } }, options: { sort: { by: "released", direction: "desc" } } });
    const compiled = compileDocument(document, { today: () => "2026-10-15" });
    if (!compiled.ok) throw new Error("did not compile");
    const text = said(compiled.app as GraviewApp<AnySchema>, "releases-by-format");
    expect(text.indexOf("Now and Then")).toBeLessThan(text.indexOf("Love Me Do"));
    expect(text.indexOf("Abbey Road")).toBeLessThan(text.indexOf("Please Please Me"));
  });
});
