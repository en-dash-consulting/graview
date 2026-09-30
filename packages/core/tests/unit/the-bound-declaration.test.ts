import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";

/**
 * WHAT THE SKILL WRITES, THE BOUND DECLARATION TAKES.
 *
 * Tests here are not typechecked, so a property the runtime reads and the
 * bound type refuses passes every test and fails the first product that
 * follows the skill. This compiles a file written the skill's way.
 */
const here = dirname(fileURLToPath(import.meta.url));

function errorsIn(file: string): string[] {
  const program = ts.createProgram([file], {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    strict: true,
    noEmit: true,
    skipLibCheck: true,
    esModuleInterop: true,
  });
  return ts
    .getPreEmitDiagnostics(program)
    .filter((diagnostic) => diagnostic.file?.fileName === file)
    .map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"));
}

describe("the bound defineInvariant", () => {
  it("takes judgesPast written as a property, the way graview-invariant says to", () => {
    expect(errorsIn(resolve(here, "../types/judges-past.ts"))).toEqual([]);
  });
});
