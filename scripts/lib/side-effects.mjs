/**
 * WHETHER A BUNDLER KEEPS A FILE IT IS ONLY IMPORTED FOR (FR-209). A
 * package's `sideEffects` is `false` (no file has any), absent (every file
 * may), or a list of the files that do — a path from the package's root, a
 * glob of one, or a pattern with no slash, matched against the file's name,
 * as webpack and esbuild read it. A bundle that tree-shakes (wrangler's,
 * Cloud's) drops a bare `import "<entry>"` of any other file: so a measure
 * that resolves `@graview/*` itself says what the package says, or it
 * measures a module the real bundle leaves out.
 */
import { basename } from "node:path";

/** A `sideEffects` glob as a pattern: `**` crosses folders, `*` does not. */
const patternOf = (glob) =>
  new RegExp(
    `^${glob
      .replace(/^\.\//, "")
      .replace(/[.+^${}()|[\]\\]/g, "\\$&")
      .replace(/\*\*\//g, "\u0000")
      .replace(/\*\*/g, "\u0001")
      .replace(/\*/g, "[^/]*")
      .replace(/\?/g, "[^/]")
      .replace(/\u0000/g, "(?:.*/)?")
      .replace(/\u0001/g, ".*")}$`,
  );

/** Whether `file` — a path from the package's root, `/`-separated — is one the manifest says a bundler must keep when it is imported for nothing. */
export function hasSideEffects(manifest, file) {
  const said = manifest.sideEffects;
  if (said === undefined || said === true) return true;
  if (!Array.isArray(said)) return false;
  const path = file.replace(/^\.\//, "").split("\\").join("/");
  return said.some((glob) => (glob.includes("/") ? patternOf(glob).test(path) : patternOf(glob).test(basename(path))));
}
