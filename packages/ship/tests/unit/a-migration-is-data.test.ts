import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { editDeclaration } from "../../src/dev.js";
import { stepsMigration } from "../../src/index.js";

/**
 * A MIGRATION AS DATA — the same steps the studio shows before a change,
 * writes into the app, and ship runs when a stored graph opens.
 */
describe("a relation that moved to another kind", () => {
  const stored = {
    nodes: [
      { id: "erin", kind: "gardener", label: "Erin" },
      { id: "back", kind: "plot", label: "Back bed" },
      { id: "front", kind: "plot", label: "Front bed" },
      { id: "kale", kind: "planting", label: "Kale" },
      { id: "beans", kind: "planting", label: "Beans" },
    ],
    edges: [
      { kind: "tended-by", from: "back", to: "erin" },
      { kind: "tended-by", from: "front", to: "erin" },
      { kind: "grows-in", from: "kale", to: "back" },
      { kind: "grows-in", from: "beans", to: "back" },
    ],
  };

  it("is carried to what of the new kind is tied to each old end, and taken off the old end", () => {
    const migration = stepsMigration({ from: 1, to: 2, steps: [{ what: "move-edge", kind: "plot", edge: "tended-by", to: "planting" }] });
    expect(migration.title).toBe("plot tended-by edges move to the planting records tied to each plot");
    const primitives = migration.apply(stored as never);
    expect(primitives).toEqual([
      { op: "remove-edge", edge: { kind: "tended-by", from: "back", to: "erin" } },
      { op: "add-edge", edge: { kind: "tended-by", from: "kale", to: "erin" } },
      { op: "add-edge", edge: { kind: "tended-by", from: "beans", to: "erin" } },
      // Nothing grows in the front bed, so nothing inherits its caretaker: the edge goes.
      { op: "remove-edge", edge: { kind: "tended-by", from: "front", to: "erin" } },
    ]);
  });
});

describe("the migration, written into the app's own defineApp", () => {
  const app = (name: string) => fileURLToPath(new URL(`../../../../apps/${name}/src/domain/app.ts`, import.meta.url));
  const change = (version: number) =>
    ({
      what: "add-migration",
      version,
      text: 'stepsMigration({ from: 1, to: 2, steps: [{ what: "move-edge", kind: "plot", edge: "tended-by", to: "planting" }] })',
      import: { name: "stepsMigration", from: "@graview/ship/browser" },
    }) as const;

  it("starts the list and the version in an app that had neither", async () => {
    const edited = editDeclaration(ts, [{ path: "src/domain/app.ts", text: await readFile(app("seedbed"), "utf8") }], [change(2)]);
    expect(edited.ok).toBe(true);
    if (!edited.ok) return;
    const after = edited.files[0]!.text;
    expect(after).toContain('migrations: [stepsMigration({ from: 1, to: 2, steps: [{ what: "move-edge"');
    expect(after).toContain("version: 2");
    expect(after).toContain('import { stepsMigration } from "@graview/ship/browser";');
    expect(ts.transpileModule(after, { reportDiagnostics: true }).diagnostics).toEqual([]);
  });

  it("joins the list an app already keeps, and moves its version on", async () => {
    const text = await readFile(app("rota"), "utf8");
    const edited = editDeclaration(ts, [{ path: "src/domain/app.ts", text }], [change(4)]);
    expect(edited.ok).toBe(true);
    if (!edited.ok) return;
    const after = edited.files[0]!.text;
    expect(after).toContain("version: 4,");
    expect(after).not.toContain("version: 3,");
    // The migrations it had are still there, in order, with the new one last.
    expect(after.indexOf("The roster adopts a limit")).toBeLessThan(after.indexOf("Where a shift happens is a location"));
    expect(after.indexOf("Where a shift happens is a location")).toBeLessThan(after.indexOf("stepsMigration({"));
    expect(ts.transpileModule(after, { reportDiagnostics: true }).diagnostics).toEqual([]);
  });
});
