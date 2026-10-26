import { compileDocument } from "@graview/core/check";
import type { GraviewDocument } from "@graview/core/document";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { createStudio } from "../../src/index.js";

/*
 * WHAT A DECLARATION SAYS IS WRITTEN BACK AS TEXT. The app's name comes from
 * a document somebody else may have written, and a new act's title from
 * whoever proposed it; the studio writes both into TypeScript a checkout
 * then imports. A name that closes the comment it sits in, or a title that
 * opens an interpolation in the history's sentence, must stay words: the
 * files are imported here and nothing they were handed runs.
 */
const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, "../.generated", `text-${process.pid}-${Date.now()}`);
afterAll(() => rmSync(out, { recursive: true, force: true }));

const fixture = resolve(here, "../../../core/tests/document/fixtures/vendors.gdd.json");
const NAME = "Vendors */ (globalThis as any).__plantedName = 1; /*\n// and a line";
const TITLE = "Paid ${(globalThis as any).__plantedTitle = 1} `x` \\ */";

describe("declaration text is written back as text", () => {
  it("keeps the app's name in its comments and a new act's title in its sentence, running neither", async () => {
    const document = JSON.parse(readFileSync(fixture, "utf8")) as GraviewDocument & { name: string };
    document.name = NAME;
    const compiled = compileDocument(document);
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) return;
    const studio = createStudio(compiled.app);
    studio.store.apply({ name: "add-act", args: { kind: "declared:vendor", label: "mark-paid", title: TITLE, writes: ["quote"] } });

    const door = studio.sourceChanges().changes.find((change) => change.what === "add-act") as { text: string } | undefined;
    expect(door?.text).toBeDefined();
    expect(door!.text).not.toMatch(/`Paid \$\{/);

    const files = studio.files({ schemaVar: "vendorsSchema" });
    for (const file of files) {
      mkdirSync(resolve(out, file.path, ".."), { recursive: true });
      writeFileSync(resolve(out, file.path), file.contents, "utf8");
    }
    const planted = globalThis as Record<string, unknown>;
    delete planted["__plantedName"];
    delete planted["__plantedTitle"];
    for (const file of files) await import(pathToFileURL(resolve(out, file.path)).href);
    expect(planted["__plantedName"]).toBeUndefined();

    const mutations = files.find((file) => file.path.endsWith("mutations.ts"))!;
    const { mutations: acts } = (await import(pathToFileURL(resolve(out, mutations.path)).href)) as {
      mutations: { name: string; describe?: (args: unknown, graph: unknown) => string }[];
    };
    const paid = acts.find((act) => act.name === "mark-paid")!;
    expect(paid.describe!({ id: "vendor:a" }, { getNode: () => ({ label: "Acme" }) })).toBe(`${TITLE}: Acme`);
    expect(planted["__plantedTitle"]).toBeUndefined();
  });

  it("writes an argument or a field name that is not a word as a quoted key, never as code", () => {
    const document = JSON.parse(readFileSync(fixture, "utf8")) as GraviewDocument;
    const compiled = compileDocument(document);
    if (!compiled.ok) throw new Error("the fixture compiles");
    const studio = createStudio(compiled.app);
    const hostile = "quote }); (globalThis as any).__plantedField = 1; ({ x";
    studio.store.apply({ name: "add-act", args: { kind: "declared:vendor", label: "mark-odd", title: "Mark odd", writes: [hostile] } });
    const door = studio.sourceChanges().changes.find((change) => change.what === "add-act") as { text: string };
    expect(door.text).toContain(JSON.stringify(hostile));
    expect(door.text).not.toContain(`args.${hostile}`);
    expect(door.text).not.toContain(`, ${hostile}:`);
  });
});
