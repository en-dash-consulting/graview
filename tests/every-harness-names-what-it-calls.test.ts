import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

/**
 * EVERY HARNESS NAMES WHAT IT CALLS. The harnesses are plain modules that
 * nothing compiles, so a name a refactor stopped importing is found only
 * when that line runs — and a harness that catches its own setup's error
 * reports it as a verdict. The journeys called `portFor` without importing
 * it for a week after the ports moved into `lib/ports.mjs`: every app
 * "could not set up", and the chain said "no regressions" (W-176).
 *
 * TypeScript reads JavaScript too; this asks it only one question of every
 * script — is each name it uses declared or imported — and leaves the
 * types alone. A `typeof` probe inside a page's `evaluate` asks about the
 * page's globals, not the module's, and is let be.
 */
const scripts = resolve(__dirname, "../scripts");
const CANNOT_FIND_NAME = new Set([2304, 2552]);

describe("the harnesses", () => {
  it("call no name they neither declare nor import", () => {
    const files = [
      ...readdirSync(scripts).filter((file) => file.endsWith(".mjs")).map((file) => resolve(scripts, file)),
      ...readdirSync(resolve(scripts, "lib")).filter((file) => file.endsWith(".mjs")).map((file) => resolve(scripts, "lib", file)),
    ];
    const program = ts.createProgram(files, {
      allowJs: true,
      checkJs: true,
      noEmit: true,
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.NodeNext,
      moduleResolution: ts.ModuleResolutionKind.NodeNext,
      lib: ["lib.es2023.d.ts", "lib.dom.d.ts"],
      types: ["node"],
      skipLibCheck: true,
    });
    const unnamed = files.flatMap((file) => {
      const source = program.getSourceFile(file);
      if (!source) return [`${file}: not read`];
      return program
        .getSemanticDiagnostics(source)
        .filter((diagnostic) => CANNOT_FIND_NAME.has(diagnostic.code) && diagnostic.start !== undefined)
        .filter((diagnostic) => {
          const at = source.text.slice(Math.max(0, (diagnostic.start ?? 0) - 7), diagnostic.start);
          return !/typeof\s+$/.test(at);
        })
        .map((diagnostic) => {
          const { line } = source.getLineAndCharacterOfPosition(diagnostic.start ?? 0);
          return `scripts/${file.slice(scripts.length + 1)}:${line + 1}: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, " ")}`;
        });
    });
    expect(unnamed).toEqual([]);
  }, 60_000);

  /*
   * ASK THE PINNED PLAYWRIGHT ONLY FOR WHAT IT HAS. Playwright is held at
   * 1.49.1 (WebKit hangs past it on this macOS), and `locator.filter({
   * visible: true })` arrived in 1.51: before it the option is ignored, not
   * refused, so `.filter({ visible: true }).first()` was simply the first
   * match. The journeys asked it 27 times; once a page kept a hidden copy
   * of a control — the phone's folded "Filter", the nav's folded links —
   * they pressed the hidden one and reported a job nobody could do (W-178).
   * `.locator("visible=true")` is the same filter, in the engine 1.49.1 has.
   */
  it("ask the pinned Playwright for nothing it ignores", () => {
    const files = [
      ...readdirSync(scripts).filter((file) => file.endsWith(".mjs")).map((file) => resolve(scripts, file)),
      ...readdirSync(resolve(scripts, "lib")).filter((file) => file.endsWith(".mjs")).map((file) => resolve(scripts, "lib", file)),
    ];
    const ignored = files.flatMap((file) =>
      readFileSync(file, "utf8")
        .split("\n")
        .flatMap((line, index) => (/\.filter\(\{[^}]*\bvisible\s*:/.test(line) ? [`scripts/${file.slice(scripts.length + 1)}:${index + 1}: ${line.trim().slice(0, 90)}`] : [])),
    );
    expect(ignored).toEqual([]);
  });
});
