import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { auditFace, FACE_READS_CONTENT, projectRootOf, withFaceFindings } from "../../src/cli/check/face.js";
import { main } from "../../src/cli/index.js";
import { scaffoldProject } from "../../src/scaffold/index.js";

/**
 * WHAT THE FACE SHOWS IS IN THE GRAPH (FR-232, Roadmap
 * f-agents-model-the-conversation). An agent kept adding what a face showed
 * — a pitch's sections, a chart's tags — as JSON files beside the graph, so
 * the scene, Find, the record pages and Ask never saw it. `graview check`
 * now reads the project's face modules and names each one that reads a JSON
 * file of the project's for content; the declaration, a seed and a template
 * are read where they are.
 */
const here = dirname(fileURLToPath(import.meta.url));
const core = resolve(here, "../../dist/index.js");

function write(root: string, file: string, text: string): void {
  mkdirSync(dirname(join(root, file)), { recursive: true });
  writeFileSync(join(root, file), text, "utf8");
}

const document = JSON.stringify({ format: "graview-document", formatVersion: 1, name: "Pitches", kinds: { pitch: { fields: { title: { type: "string" } } } } });
const template = JSON.stringify({ format: "graview-template", document: JSON.parse(document) });
const legacySeed = JSON.stringify({ nodes: [], edges: [] });
const lineSeed = `${JSON.stringify({ graview: "snapshot", format: 2, generatedAt: "2026-10-27T00:00:00Z", kinds: {}, edges: {}, parts: [] })}\n`;

describe("a face module that reads a JSON file beside the graph for content", () => {
  let root: string;
  beforeAll(() => {
    root = mkdtempSync(join(tmpdir(), "graview-face-"));
    write(root, "package.json", JSON.stringify({ name: "pitches", type: "module" }));
    write(root, "src/domain/app.json", document);
    write(root, "src/domain/app.ts", `import document from "./app.json";\nexport { document };\n`);
    write(root, "src/data/seed.json", legacySeed);
    write(root, "src/data/exported.json", lineSeed);
    write(root, "src/templates/pitches.json", template);
    write(root, "src/ui/pitch.schema.json", JSON.stringify({ $schema: "https://json-schema.org/draft/2020-12/schema" }));
    write(root, "src/content/pitch.json", JSON.stringify({ sections: [{ heading: "Why now", body: "…" }] }));
    write(root, "src/content/more.json", JSON.stringify([1, 2, 3]));
    write(root, "src/content/legacy.json", JSON.stringify({ tags: ["a"] }));
    write(root, "public/charts/tags.json", JSON.stringify({ tags: ["revenue", "churn"] }));
    // What is read where it is: the seed (both formats), the declaration, a template, a schema, the manifest.
    write(
      root,
      "src/ui/views.tsx",
      [
        `import seed from "../data/seed.json";`,
        `import exported from "../data/exported.json";`,
        `import doc from "../domain/app.json";`,
        `import tpl from "../templates/pitches.json";`,
        `import schema from "./pitch.schema.json";`,
        `import pkg from "../../package.json";`,
        `export const all = [seed, exported, doc, tpl, schema, pkg];`,
      ].join("\n"),
    );
    // Content, four ways in.
    write(
      root,
      "src/ui/pitch.tsx",
      [
        `import pitch from "../content/pitch.json";`,
        `export async function more() {`,
        `  const tags = await fetch("/charts/tags.json");`,
        `  const rest = await import("../content/more.json");`,
        `  return [pitch, tags, rest, require("../content/legacy.json")];`,
        `}`,
      ].join("\n"),
    );
    // Not the project's: a package's JSON and an alias the check cannot read.
    write(root, "src/ui/vendor.ts", `import x from "some-package/data.json";\nimport y from "@content/pitch.json";\nexport const v = [x, y];\n`);
    // A test's fixture, and a missing file (a build error already), are nobody's content.
    write(root, "src/ui/pitch.test.tsx", `import fixture from "../content/pitch.json";\nexport const f = fixture;\n`);
    write(root, "src/ui/gone.ts", `import gone from "../content/gone.json";\nexport const g = gone;\n`);
  });
  afterAll(() => rmSync(root, { recursive: true, force: true }));

  it("is a warning naming the module, the line and the file, with the fix: a kind or a field, seeded", () => {
    const findings = auditFace(root);
    expect(findings.map((f) => f.where).sort()).toEqual(["src/ui/pitch.tsx:1", "src/ui/pitch.tsx:3", "src/ui/pitch.tsx:4", "src/ui/pitch.tsx:5"]);
    for (const finding of findings) {
      expect(finding.severity).toBe("warning");
      expect(finding.code).toBe(FACE_READS_CONTENT);
      expect(finding.message).toMatch(/the scene, Find, the record pages and Ask cannot see it/);
      expect(finding.fix).toMatch(/Declare a kind/);
      expect(finding.fix).toMatch(/seed/);
    }
    const first = findings.find((f) => f.where === "src/ui/pitch.tsx:1")!;
    expect(first.message).toContain("src/ui/pitch.tsx imports src/content/pitch.json");
    expect(findings.find((f) => f.where === "src/ui/pitch.tsx:3")!.message).toContain("fetches public/charts/tags.json");
    expect(findings.find((f) => f.where === "src/ui/pitch.tsx:4")!.message).toContain("loads src/content/more.json");
    expect(findings.find((f) => f.where === "src/ui/pitch.tsx:5")!.message).toContain("requires src/content/legacy.json");
  });

  it("leaves the declaration, a seed in either format, a template, a schema, the manifest, a package's JSON and a test's fixture alone", () => {
    const files = new Set(auditFace(root).map((f) => f.where.split(":")[0]));
    expect(files).toEqual(new Set(["src/ui/pitch.tsx"]));
  });

  it("finds the project from the entry it is asked to check: the nearest package.json up", () => {
    expect(projectRootOf(join(root, "dist/domain/app.js"))).toBe(root);
    expect(auditFace(join(root, "nowhere"))).toEqual([]);
  });

  it("counts into the check's verdict as warnings, never as a failure", () => {
    const result = withFaceFindings({ app: "Pitches", findings: [], errors: 0, warnings: 0, notes: 0, ok: true }, auditFace(root));
    expect(result.warnings).toBe(4);
    expect(result.ok).toBe(true);
    expect(result.findings.filter((f) => f.code === FACE_READS_CONTENT)).toHaveLength(4);
  });
});

describe("graview check, over a project", () => {
  afterEach(() => vi.restoreAllMocks());
  const captured = () => {
    const written: string[] = [];
    vi.spyOn(process.stdout, "write").mockImplementation((chunk) => (written.push(String(chunk)), true));
    vi.spyOn(process.stderr, "write").mockImplementation((chunk) => (written.push(String(chunk)), true));
    return written;
  };
  const entry = (root: string) => {
    write(
      root,
      "dist/domain/app.js",
      [
        `import { createSchema, defineApp, defineNode, z } from ${JSON.stringify(pathToFileURL(core).href)};`,
        `const pitch = defineNode("pitch", { fields: z.object({ title: z.string() }) });`,
        `export default defineApp({ name: "Pitches", schema: createSchema([pitch]), mutations: [], invariants: [] });`,
      ].join("\n"),
    );
    return join(root, "dist/domain/app.js");
  };

  it("names the face module beside the declaration's findings, and --face names the sources", async () => {
    const root = mkdtempSync(join(tmpdir(), "graview-face-cli-"));
    try {
      write(root, "package.json", JSON.stringify({ name: "pitches", type: "module" }));
      write(root, "src/content/pitch.json", JSON.stringify({ sections: [] }));
      write(root, "src/ui/pitch.tsx", `import pitch from "../content/pitch.json";\nexport const p = pitch;\n`);
      write(root, "face/deck.tsx", `import deck from "../src/content/pitch.json";\nexport const d = deck;\n`);
      const out = captured();
      await main(["check", entry(root), "--json"]);
      const said = JSON.parse(out.join("")) as { ok: boolean; findings: { code: string; where: string }[] };
      expect(said.findings.filter((f) => f.code === FACE_READS_CONTENT).map((f) => f.where)).toEqual(["src/ui/pitch.tsx:1"]);
      out.length = 0;
      await main(["check", entry(root), "--face", join(root, "face"), "--json"]);
      const named = JSON.parse(out.join("")) as { findings: { code: string; where: string }[] };
      expect(named.findings.filter((f) => f.code === FACE_READS_CONTENT).map((f) => f.where)).toEqual(["face/deck.tsx:1"]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("says nothing of the project graview create writes", () => {
    const root = mkdtempSync(join(tmpdir(), "graview-face-scaffold-"));
    try {
      for (const file of scaffoldProject({ name: "Field Notes", kind: "note" }).files) write(root, file.path, file.contents);
      expect(auditFace(root)).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
