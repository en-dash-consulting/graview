import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, extname, join, relative, resolve } from "node:path";
import { FORMAT } from "../../document/schema.js";
import { TEMPLATE_FORMAT } from "../../document/graview-template.js";
import type { CheckResult } from "../check.js";
import type { Finding } from "./context.js";

/*
 * WHAT THE FACE SHOWS IS IN THE GRAPH (FR-232, Roadmap
 * f-agents-model-the-conversation).
 *
 * An agent asked for a pitch section added it as a JSON file a page
 * imported; asked to tag a chart, it wrote the tags beside the graph too.
 * Each looked right on the page it was written for, and the scene, Find,
 * the record pages and Ask — every surface derived from the declaration —
 * never saw any of it, because nothing was a record. The rule is in the
 * agent docs now (`agentRules`); this is the check that holds it.
 *
 * `checkApp` is handed a declaration and has no files, so this is asked by
 * the command line alone, of the project the entry is in: the nearest
 * `package.json` up from it, its `src/`, or the directory `--face` names.
 * It reads each module of the face — not the declaration (`domain/`, which
 * reads its own document), not the seed (`data/`), not a test — for a JSON
 * file of the project's it imports, loads, requires or fetches by path, and
 * judges the file by what it is: the declaration, a template, a seed in
 * either format, a schema and the manifest are read where they are; the
 * rest is content, said as a warning with the fix. A package's JSON and an
 * alias the check cannot resolve are not the project's to judge. A
 * warning, never an error: a design's own copy may be meant.
 */

export const FACE_READS_CONTENT = "face-reads-content-beside-the-graph";

const FACE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".mts", ".cts"]);
/** Folders no face module is in: what a build wrote, the declaration, the seed, the tests. */
const NOT_THE_FACE = new Set(["node_modules", "dist", "build", ".git", "domain", "data", "tests", "test", "__tests__"]);
/** A read of a JSON file by path — `./`, `../` or `/` — as a static import, a dynamic one, a require or a fetch. */
const READS = /\b(import\s*\(|require\s*\(|fetch\s*\(|import\s+(?:type\s+)?(?:[\w$*{}\s,]+?\s+from\s+)?)\s*(["'])((?:\.\.?\/|\/)[^"'\n]*?\.json)\2/g;

type How = "imports" | "loads" | "requires" | "fetches";
type What = "document" | "template" | "seed" | "schema" | "manifest" | "content" | "missing" | "not-json";

/** The project an entry belongs to: the nearest directory up from it with a `package.json`. */
export function projectRootOf(entry: string): string | undefined {
  let here = dirname(resolve(entry));
  for (;;) {
    if (existsSync(join(here, "package.json"))) return here;
    const up = dirname(here);
    if (up === here) return undefined;
    here = up;
  }
}

function modulesUnder(dir: string): string[] {
  const out: string[] = [];
  const walk = (at: string) => {
    for (const name of readdirSync(at).sort()) {
      const path = join(at, name);
      const stat = statSync(path);
      if (stat.isDirectory()) {
        if (!NOT_THE_FACE.has(name)) walk(path);
        continue;
      }
      if (!FACE_EXTENSIONS.has(extname(name)) || /\.d\.[cm]?ts$/.test(name) || /\.(test|spec|stories)\./.test(name)) continue;
      out.push(path);
    }
  };
  walk(dir);
  return out;
}

/** What a JSON file is, read from it rather than from its name wherever it can be. */
function whatIs(path: string): What {
  if (!existsSync(path)) return "missing";
  const name = basename(path);
  if (name === "package.json") return "manifest";
  if (name.endsWith(".schema.json") || /^tsconfig(\..+)?\.json$/.test(name)) return "schema";
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    return "missing";
  }
  const parse = (source: string): unknown => {
    try {
      return JSON.parse(source);
    } catch {
      return undefined;
    }
  };
  // A snapshot in the line format says so on its first line, and the rest is one record a line.
  const firstLine = parse(text.slice(0, text.indexOf("\n") === -1 ? text.length : text.indexOf("\n")));
  if (firstLine && typeof firstLine === "object" && (firstLine as { graview?: unknown }).graview === "snapshot") return "seed";
  const whole = parse(text);
  if (whole === undefined) return "not-json";
  if (!whole || typeof whole !== "object" || Array.isArray(whole)) return "content";
  const object = whole as Record<string, unknown>;
  if (object["format"] === FORMAT) return "document";
  if (object["format"] === TEMPLATE_FORMAT) return "template";
  if (Array.isArray(object["nodes"]) && Array.isArray(object["edges"])) return "seed";
  if (typeof object["$schema"] === "string" && /json-schema/.test(object["$schema"] as string)) return "schema";
  return "content";
}

function howOf(opening: string): How {
  if (opening.startsWith("import") && opening.trimEnd().endsWith("(")) return "loads";
  if (opening.startsWith("require")) return "requires";
  if (opening.startsWith("fetch")) return "fetches";
  return "imports";
}

/**
 * The face modules under `face` (the project's `src/` unless said) that
 * read a JSON file of the project's for content, each a warning: where, in
 * `file:line`; what reads what; and the fix.
 */
export function auditFace(root: string, face: string = join(root, "src")): Finding[] {
  if (!existsSync(face) || !statSync(face).isDirectory()) return [];
  const findings: Finding[] = [];
  const say = (path: string) => relative(root, path).split("\\").join("/");
  for (const module of modulesUnder(face)) {
    const text = readFileSync(module, "utf8");
    for (const match of text.matchAll(READS)) {
      const specifier = match[3]!;
      const how = howOf(match[1]!);
      // A path from the site's root is served from `public/`, or from the project's root.
      const candidates = specifier.startsWith("/") ? [join(root, "public", specifier), join(root, specifier)] : [resolve(dirname(module), specifier)];
      const target = candidates.find((candidate) => existsSync(candidate)) ?? candidates[0]!;
      if (whatIs(target) !== "content") continue;
      const line = text.slice(0, match.index).split("\n").length;
      const file = say(module);
      const read = say(target);
      findings.push({
        severity: "warning",
        code: "face-reads-content-beside-the-graph",
        where: `${file}:${line}`,
        message: `${file} ${how} ${read}, a file beside the graph: what it shows from there is on no record, so the scene, Find, the record pages and Ask cannot see it.`,
        fix: `Declare a kind (or a field on one) for what ${read} holds, seed it as records — a snapshot under src/data/, or graview sync-seed on a served store — and read them from the store; the declaration, a seed and a template are read where they are.`,
      });
    }
  }
  return findings;
}

/** The check's verdict with the face's findings counted in: warnings, never a failure. */
export function withFaceFindings(result: CheckResult, face: readonly Finding[]): CheckResult {
  if (face.length === 0) return result;
  const findings = [...result.findings, ...face];
  const errors = findings.filter((f) => f.severity === "error").length;
  const notes = findings.filter((f) => f.severity === "note").length;
  return { ...result, findings, errors, notes, warnings: findings.length - errors - notes, ok: errors === 0 };
}
