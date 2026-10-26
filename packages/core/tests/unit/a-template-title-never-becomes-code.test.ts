import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { scaffoldProject, validateScaffoldOptions } from "../../src/scaffold/index.js";
import { escapeTemplate } from "../../src/scaffold/names.js";

/**
 * A template is data: `graview create --template` takes its title as the
 * project's name unless --name is given, and the template may have been
 * written by anybody. The name goes into comments, string literals,
 * template literals and JSX text across the files the scaffolder writes, so
 * each of those has to hold it as text. Every generated TypeScript file is
 * parsed for a hostile name and compared, statement for statement, with
 * the same project made under a plain one.
 */

const fixture = resolve(import.meta.dirname, "../document/fixtures/vendor-shortlist.template.json");
const template = JSON.parse(readFileSync(fixture, "utf8")) as { title: string; document: Record<string, unknown> };

const HOSTILE = [
  "Acme */ globalThis.__planted = 1; /*",
  "Acme`);}globalThis.__planted=1;function q(){(`",
  "Acme ${globalThis.__planted = 1}",
  "Acme {globalThis.__planted = 1} <b>bold</b>",
  'Acme " + (globalThis.__planted = 1) + "',
  "Acme ' + (globalThis.__planted = 1) + '",
  "Acme \\` ${globalThis.__planted = 1}",
];

type Shape = { readonly statements: number; readonly problems: readonly string[]; readonly planted: boolean };

function shapeOf(path: string, text: string): Shape {
  const kind = path.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, kind);
  const diagnostics = (source as unknown as { parseDiagnostics: readonly ts.Diagnostic[] }).parseDiagnostics;
  let planted = false;
  const walk = (node: ts.Node): void => {
    if (ts.isIdentifier(node) && node.text.toLowerCase().includes("__planted")) planted = true;
    ts.forEachChild(node, walk);
  };
  walk(source);
  return {
    statements: source.statements.length,
    problems: diagnostics.map((d) => ts.flattenDiagnosticMessageText(d.messageText, "\n")),
    planted,
  };
}

function shapes(name: string, withTemplate: boolean): Map<string, Shape> {
  const made = scaffoldProject({ name, ...(withTemplate ? { template: template as never } : {}) });
  const out = new Map<string, Shape>();
  for (const file of made.files) {
    if (!/\.(ts|tsx|mts)$/.test(file.path)) continue;
    out.set(file.path, shapeOf(file.path, file.contents));
  }
  return out;
}

describe("a template's title never becomes code in the project made from it", () => {
  for (const withTemplate of [false, true]) {
    const plain = shapes("Acme", withTemplate);
    for (const name of HOSTILE) {
      it(`writes ${JSON.stringify(name)} as text in every file${withTemplate ? ", made from a template" : ""}`, () => {
        expect(validateScaffoldOptions({ name })).toEqual([]);
        const hostile = shapes(name, withTemplate);
        expect([...hostile.keys()]).toEqual([...plain.keys()]);
        for (const [path, shape] of hostile) {
          expect({ path, problems: shape.problems }).toEqual({ path, problems: [] });
          expect({ path, planted: shape.planted }).toEqual({ path, planted: false });
          expect({ path, statements: shape.statements }).toEqual({ path, statements: plain.get(path)!.statements });
        }
      });
    }
  }

  it("refuses a name that would end a line of the file it is written into", () => {
    for (const name of ["Acme\nglobalThis.x = 1", "Acme\rB", "Acme\u2028B", "Acme\u0000"]) {
      expect(validateScaffoldOptions({ name }).join(" ")).toMatch(/control character|line break/);
    }
  });

  it("escapes a backtick and an interpolation for a template literal with a real backslash", () => {
    expect(escapeTemplate("a`b${c}\\d")).toBe("a\\`b\\${c}\\\\d");
    // eslint-disable-next-line no-new-func
    expect(new Function(`return \`${escapeTemplate("a`b${c}\\d")}\`;`)()).toBe("a`b${c}\\d");
  });
});
