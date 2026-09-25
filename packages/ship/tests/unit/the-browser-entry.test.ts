import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * THE ENTRY A PAGE MAY IMPORT, AND THE ONE THAT WILL NOT SAY WHY IT CANNOT.
 *
 * This package holds both halves of shipping: the browser adapter an app
 * runs in a page, and the CLI that serves and exports it. The main entry
 * reaches both, which is right for Node and fatal in a bundler — and the
 * way it is fatal is the problem. `dist/cli.js` opens with a shebang, so a
 * browser build that imports `@graview/ship` dies inside the bundler's
 * PARSER: "Expected ident", no file, no line, no mention of this package.
 * An hour was spent on that error by somebody who had written the import in
 * good faith, and the fix was one word.
 *
 * So the browser entry earns its keep by being checked rather than
 * intended: whatever it reaches must be something a page can actually run.
 */

const here = dirname(fileURLToPath(import.meta.url));
const dist = resolve(here, "../../dist");

/** Everything the entry reaches, following relative imports through dist. */
function reached(entry: string): Map<string, string> {
  const found = new Map<string, string>();
  const walk = (file: string) => {
    if (found.has(file)) return;
    const source = readFileSync(file, "utf8");
    found.set(file, source);
    for (const match of source.matchAll(/from\s+"(\.[^"]+)"/g)) {
      walk(resolve(dirname(file), match[1]!));
    }
  };
  walk(resolve(dist, entry));
  return found;
}

describe("what the browser entry reaches", () => {
  it("is nothing a page cannot run: no node: builtin, anywhere in the graph", () => {
    const offenders: string[] = [];
    for (const [file, source] of reached("browser.js")) {
      const builtins = [...source.matchAll(/from\s+"(node:[^"]+)"/g)].map((m) => m[1]!);
      if (builtins.length > 0) offenders.push(`${file.slice(dist.length + 1)} → ${builtins.join(", ")}`);
    }
    expect(offenders).toEqual([]);
  });

  it("is nothing a parser will choke on: no shebang, anywhere in the graph", () => {
    for (const [file, source] of reached("browser.js")) {
      expect(source.startsWith("#!"), file).toBe(false);
    }
  });

  it("carries the photograph budget, which is domain work about a browser's quota", () => {
    /*
     * The check runs BEFORE the act that would store a photograph, which
     * means it runs in the domain tier of an app in a page. Leaving it
     * reachable only from the Node entry would have made it unreachable
     * from the only place it is for.
     */
    const source = readFileSync(resolve(dist, "browser.js"), "utf8");
    expect(source).toContain("photos.js");
  });
});

describe("the main entry, which a page may not import", () => {
  it("really does reach a node: builtin, so the guard above is not guarding nothing", () => {
    /*
     * The shebang itself lives in the `graview` package now; what stays here
     * is the file adapter and the server, which a page cannot run either.
     */
    const graph = reached("index.js");
    const nodeOnly = [...graph].filter(([, source]) => /from\s+"node:/.test(source));
    expect(nodeOnly.length, "if this is 0 the Node half moved and the browser guard is theatre").toBeGreaterThan(0);
  });
});
