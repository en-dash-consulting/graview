import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { create, type CreateIo } from "../../src/cli/create.js";
import { main } from "../../src/cli/index.js";
import type { Diagnostic } from "typescript";
import { describeApp } from "../../src/cli/describe.js";
import { compileDocument } from "../../src/check.js";
import { scaffoldProject } from "../../src/scaffold/index.js";

/**
 * FR-08. `graview create --template` scaffolds a real TypeScript checkout
 * from a template made anywhere — Graview Cloud's included — and the project
 * KEEPS the document: `src/domain/app.json` is the declaration, compiled by
 * `compileDocument` when the domain loads, so what `graview describe` says of
 * the project is what it says of the template's document, by construction.
 */
const fixture = resolve(import.meta.dirname, "../document/fixtures/vendor-shortlist.template.json");
const template = JSON.parse(readFileSync(fixture, "utf8")) as { title: string; document: Record<string, unknown> };

let scratch: string;
let cwd: string;
beforeEach(() => {
  scratch = mkdtempSync(join(tmpdir(), "graview-create-template-"));
  cwd = process.cwd();
  process.chdir(scratch);
});
afterEach(() => {
  process.chdir(cwd);
  rmSync(scratch, { recursive: true, force: true });
});

function io() {
  const out: string[] = [];
  const err: string[] = [];
  const handle: CreateIo = { stdout: (t) => void out.push(t), stderr: (t) => void err.push(t), run: () => true, ask: () => undefined };
  return { handle, out: () => out.join(""), err: () => err.join("") };
}

async function said(argv: string[]): Promise<string> {
  const chunks: string[] = [];
  const spy = vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
    chunks.push(String(chunk));
    return true;
  });
  try {
    expect(await main(argv)).toBe(0);
  } finally {
    spy.mockRestore();
  }
  return chunks.join("");
}

describe("graview create --template", () => {
  it("writes the template's document as the project's declaration, and the template beside it for apply", async () => {
    const t = io();
    const code = await create(["vendors", "--template", fixture, "--no-install", "--no-git"], t.handle);
    expect(t.err()).toBe("");
    expect(code).toBe(0);
    const project = resolve(scratch, "vendors");
    expect(JSON.parse(readFileSync(resolve(project, "src/domain/app.json"), "utf8"))).toEqual(template.document);
    expect(JSON.parse(readFileSync(resolve(project, "template.json"), "utf8"))).toEqual(template);
    const app = readFileSync(resolve(project, "src/domain/app.ts"), "utf8");
    expect(app).toContain('import document from "./app.json" with { type: "json" }');
    expect(app).toContain("compileDocument(document)");
    // Named after the template, as a person would say it, unless told otherwise.
    expect(JSON.parse(readFileSync(resolve(project, "package.json"), "utf8")).name).toBe("vendor-shortlist");
    expect(t.out()).toContain("apply-template");
  });

  it("is described exactly as the template's document is", async () => {
    await create(["vendors", "--template", fixture, "--no-install", "--no-git"], io().handle);
    const ofTheProject = await said(["describe", resolve(scratch, "vendors/src/domain/app.json")]);
    const ofTheTemplate = await said(["describe", fixture]);
    const compiled = compileDocument(template.document);
    if (!compiled.ok) throw new Error("the fixture compiles");
    expect(ofTheTemplate).toBe(`${describeApp(compiled.app)}\n`);
    expect(ofTheProject).toBe(ofTheTemplate);
  });

  it("refuses a template that does not instantiate before writing anything, saying where", async () => {
    const broken = resolve(scratch, "broken.json");
    writeFileSync(broken, JSON.stringify({ ...template, setup: [{ act: "add-venue", args: {} }] }));
    const t = io();
    expect(await create(["vendors", "--template", broken, "--no-install", "--no-git"], t.handle)).toBe(2);
    expect(t.err()).toContain('setup.0.act: "add-venue" is not an act');
    expect(() => readFileSync(resolve(scratch, "vendors/package.json"))).toThrow();
  });

  it("keeps the rest of the project the one graview create always writes, with its gate on an act that creates", () => {
    const scaffold = scaffoldProject({ name: "Vendor shortlist", template: template as never });
    const paths = scaffold.files.map((f) => f.path);
    expect(paths).toEqual(expect.arrayContaining(["src/domain/app.json", "src/domain/app.ts", "src/domain/schema.ts", "src/domain/brand.ts", "template.json", "src/ui/app.tsx", "src/ui/pages.tsx", "tests/domain.test.ts"]));
    // The declaration is the document now; there is no TypeScript copy of it to drift.
    expect(paths).not.toContain("src/domain/mutations.ts");
    expect(paths).not.toContain("src/domain/invariants.ts");
    const ui = scaffold.files.find((f) => f.path === "src/ui/app.tsx")!.contents;
    expect(ui).toContain('gate="add-category"');
    const manifest = JSON.parse(scaffold.files.find((f) => f.path === "package.json")!.contents) as { scripts: Record<string, string> };
    expect(manifest.scripts["apply-template"]).toBe("pnpm build:domain && graview apply ./dist/domain/app.js --template template.json --data data");
  });

  it("writes TypeScript that parses and JSON that is JSON, in either layout", async () => {
    const ts = await import("typescript");
    for (const workspace of [false, true]) {
      for (const file of scaffoldProject({ name: "Vendor shortlist", template: template as never, workspace }).files) {
        if (file.path.endsWith(".json")) expect(() => JSON.parse(file.contents), file.path).not.toThrow();
        if (!/\.tsx?$/.test(file.path)) continue;
        const parsed = ts.createSourceFile(file.path, file.contents, ts.ScriptTarget.ES2022, true, file.path.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
        const problems = (parsed as unknown as { parseDiagnostics: readonly Diagnostic[] }).parseDiagnostics;
        expect(problems.map((one) => ts.flattenDiagnosticMessageText(one.messageText, " ")), file.path).toEqual([]);
      }
    }
  });

  it("imports every name each file calls, and nothing it does not use, with or without a template", async () => {
    // tests/domain.test.ts called checkApp and instantiateTemplate without importing them, and app.ts imported both and used neither.
    const ts = await import("typescript");
    for (const options of [{ name: "Vendor shortlist", template: template as never }, { name: "Field Notes" }]) {
      const files = new Map(scaffoldProject(options).files.filter((file) => /\.tsx?$/.test(file.path)).map((file) => [`/project/${file.path}`, file.contents]));
      const compilerOptions = { noEmit: true, noUnusedLocals: true, noResolve: true, types: [], lib: ["lib.es2022.d.ts", "lib.dom.d.ts", "lib.dom.iterable.d.ts"], jsx: ts.JsxEmit.Preserve, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, skipLibCheck: true };
      const host = ts.createCompilerHost(compilerOptions);
      const read = host.getSourceFile.bind(host);
      host.getSourceFile = (name, version) => (files.has(name) ? ts.createSourceFile(name, files.get(name)!, version, true) : read(name, version));
      const program = ts.createProgram([...files.keys()], compilerOptions, host);
      // Cannot find name (2304, 2552), declared and never read (6133), every import unused (6192): what a module that does not resolve still says.
      const named = [...files.keys()].flatMap((path) =>
        [...program.getSemanticDiagnostics(program.getSourceFile(path)), ...program.getSyntacticDiagnostics(program.getSourceFile(path))]
          .filter((one) => [2304, 2552, 6133, 6192].includes(one.code))
          .map((one) => `${path.slice("/project/".length)}: ${ts.flattenDiagnosticMessageText(one.messageText, " ")}`),
      );
      expect(named, options.name).toEqual([]);
    }
  });
});
