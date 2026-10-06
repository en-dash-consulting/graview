import { readFileSync } from "node:fs";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createSchema, defineApp, defineNode, z } from "@graview/core";
import { checkApp } from "@graview/core/check";
import { compileDocumentWithoutCheck, toDocument, type GraviewDocument } from "@graview/core/document";
import { afterAll, describe, expect, it } from "vitest";
import { createStudio } from "../../src/index.js";

/*
 * FR-83 left the studio a gap: a computed field — a value a kind works out
 * rather than stores — was no node in the studio's meta-schema, so opening
 * an app in the studio and handing it back (or writing its kinds back as
 * TypeScript) lost every one, and a glance that said one named nothing.
 * Now a computed field is a node like a field: read in, handed back in the
 * same words, written into `defineNode`, and a rename in the studio walks
 * its expression as it walks a rule's.
 */
const lifelogics = JSON.parse(readFileSync(new URL("../../../core/tests/document/fixtures/lifelogics.gdd.json", import.meta.url), "utf8")) as GraviewDocument;

function studioOn(document: GraviewDocument) {
  const compiled = compileDocumentWithoutCheck(document);
  if (!compiled.ok) throw new Error(JSON.stringify(compiled.findings));
  return createStudio(compiled.app);
}

const computedOf = (document: GraviewDocument) => Object.fromEntries(Object.entries(document.kinds).flatMap(([kind, spec]) => (spec.computed ? [[kind, spec.computed]] : [])));

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, "../.generated", `computed-${process.pid}-${Date.now()}`);
afterAll(() => rmSync(out, { recursive: true, force: true }));

describe("a computed field is part of the declaration the studio holds", () => {
  it("is a node of its own, on its kind, with its expression and the words it is shown by", () => {
    const studio = studioOn(lifelogics);
    const total = studio.store.graph.getNode("computed:offer.total") as Record<string, unknown> | undefined;
    expect(total).toMatchObject({ kind: "computed", label: "total", expr: "list * units", shownAs: "At list, in all" });
    expect(studio.store.graph.out("computed:offer.total", "computed-on").map((node) => node.id)).toEqual(["declared:offer"]);
  });

  it("an app opened and handed back unchanged keeps every computed field, in the same words", () => {
    const studio = studioOn(lifelogics);
    const declared = studio.declaration();
    expect(toDocument(declared).document.kinds["offer"]?.computed).toEqual(lifelogics.kinds["offer"]!.computed);
    expect(computedOf(toDocument(declared).document)).toEqual(computedOf(lifelogics));
    // A glance that says a computed field still names something, so the declaration checks clean of it.
    expect(studio.check().findings.filter((finding) => /glance|computed/.test(finding.code) && finding.severity === "error")).toEqual([]);
  });

  it("a kind with computed fields is written back as TypeScript that keeps them, and runs", async () => {
    const line = defineNode("line", {
      fields: z.object({ label: z.string().min(1).max(80), price: z.number(), units: z.number().int() }),
      computed: { total: "price * units", taxed: { expr: "total * 1.2", label: "With tax" } },
      label: (node) => node.label,
      plural: "lines",
      display: { glance: ["total"] },
    });
    const app = defineApp({ name: "Lines", schema: createSchema([line]) });
    const studio = createStudio(app);
    const files = studio.files({ schemaVar: "linesSchema" });
    const schemaFile = files.find((file) => file.path.endsWith("schema.ts"))!;
    expect(schemaFile.contents).toContain(`computed: {`);
    expect(schemaFile.contents).toContain(`total: "price * units"`);
    expect(schemaFile.contents).toContain(`taxed: { expr: "total * 1.2", label: "With tax" }`);
    mkdirSync(resolve(out, "src/domain"), { recursive: true });
    for (const file of files) writeFileSync(resolve(out, file.path), file.contents, "utf8");
    const written = (await import(pathToFileURL(resolve(out, schemaFile.path)).href)) as Record<string, ReturnType<typeof createSchema>>;
    const schema = written["linesSchema"]!;
    expect(schema.tryDefinition("line")?.computed).toEqual({ total: "price * units", taxed: { expr: "total * 1.2", label: "With tax" } });
    expect(checkApp(defineApp({ name: "Lines", schema })).findings.filter((finding) => finding.severity === "error")).toEqual([]);
  });

  it("renaming a field walks every computed expression that reads it, and leaves another kind's name of the same spelling alone", () => {
    const studio = studioOn(lifelogics);
    studio.store.apply({ name: "rename-field", args: { id: "field:offer.list", to: "price" } });
    const document = toDocument(studio.declaration()).document;
    expect(document.kinds["offer"]!.computed!["total"]).toEqual({ expr: "price * units", label: "At list, in all" });
    // A package's `list` sums its offers' list prices: the per-member name follows…
    expect(document.kinds["package"]!.computed!["list"]).toEqual({ expr: "sum(out('includes'), price * units)", label: "At list" });
    // …and its `net`, which reads the package's own computed `list`, does not.
    expect(document.kinds["package"]!.computed!["net"]).toEqual(lifelogics.kinds["package"]!.computed!["net"]);
    // The document the studio hands back says the same.
    const handed = studio.document();
    expect(handed?.ok).toBe(true);
    if (!handed?.ok) return;
    expect(handed.document.kinds["offer"]!.computed!["total"]).toEqual({ expr: "price * units", label: "At list, in all" });
  });

  it("renaming a kind walks the computed expressions that sweep it", () => {
    const studio = studioOn(lifelogics);
    studio.store.apply({ name: "rename-kind", args: { id: "declared:party", label: "firm" } });
    const document = toDocument(studio.declaration()).document;
    expect((document.kinds["offer"]!.computed!["net"] as { expr: string }).expr).toContain("all('firm')");
  });

  it("removing a kind takes its computed fields with it", () => {
    const studio = studioOn(lifelogics);
    studio.store.apply({ name: "remove-kind", args: { id: "declared:package" } });
    expect(studio.store.graph.getNode("computed:package.net")).toBeUndefined();
  });
});
