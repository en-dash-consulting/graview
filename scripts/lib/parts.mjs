/**
 * A HARNESS RUN IN PARTS, side by side.
 *
 * One harness was most of the chain: `quiet` sweeps Cloud's two apps in
 * three engines, two schemes and every width and box, and took 2,589 s on
 * a laptop and 2,909 s on a runner — longer than the whole chain is meant
 * to take, however wide the pool. Its engines share nothing, so it runs as
 * one part per engine and section (`quiet.firefox-boxes`, `quiet.webkit-rest`),
 * each its own process on its own worker, and each writes its verdict
 * beside the harness's (`partPath`: docs/chrome-quiet.part-webkit.json).
 * Once every part has run, `mergeParts` writes the harness's verdict from
 * them: each claim holds only where it held in every part, said part by
 * part.
 *
 * A part is named `<harness>.<part>`, so a shard on GitHub can take one
 * (`pnpm verify quiet.webkit-boxes`); the harness's name alone is every part.
 */
import { existsSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

export const PART_ENV = "GRAVIEW_PART";

/** The harnesses run in parts: each part's name, its arguments, the engine whose watch it writes, and the verdict the parts make. */
const byEngine = (verdict, engines = ["chromium", "webkit", "firefox"]) => ({ verdict, parts: engines.map((engine) => ({ part: engine, args: [`--engine=${engine}`], engine })) });

export const PARTS = {
  /* The next longest, each an engine at a time with nothing shared between engines: 627 s, 623 s and 386 s on a laptop. */
  address: byEngine("docs/address.json"),
  "scene-hands": byEngine("docs/scene-hands.json", ["chromium", "webkit"]),
  "drawn-once": byEngine("docs/drawn-once.json"),
  /*
   * quiet, each engine as six parts: its five sections that run alone
   * (`--steady`, `--standing`, `--picks`, `--boxes`, `--notices`) and the
   * rest (`--rest`). Whole, Firefox alone took 1,430 s beside the others.
   */
  quiet: {
    verdict: "docs/chrome-quiet.json",
    parts: ["chromium", "webkit", "firefox"].flatMap((engine) =>
      ["steady", "standing", "picks", "boxes", "notices", "rest"].map((section) => ({ part: `${engine}-${section}`, args: [`--engine=${engine}`, `--${section}`], engine })),
    ),
  },
};

/** Where a harness writes its verdict: the path, or beside it when it runs as a part (GRAVIEW_PART). */
export function partPath(path, part = process.env[PART_ENV]) {
  return part ? path.replace(/\.json$/, `.part-${part}.json`) : path;
}

/** A unit of the chain's work: a harness, or one part of one. */
export const unitName = (name, part) => (part ? `${name}.${part}` : name);
/** The harness a unit is of, and its part: `quiet.webkit` is `quiet` and `webkit`. */
export function splitUnit(unit) {
  const at = unit.indexOf(".");
  return at === -1 ? { name: unit, part: null } : { name: unit.slice(0, at), part: unit.slice(at + 1) };
}

/** Every unit name the chain knows: each harness's own name, and each part of one run in parts. */
export const allUnits = (names) => names.flatMap((name) => [name, ...(PARTS[name]?.parts.map(({ part }) => unitName(name, part)) ?? [])]);

/**
 * The units to run for the names asked: a harness in parts is each of its
 * parts, a part is itself, any other harness is itself.
 */
export function unitsOf(names) {
  return names.flatMap((unit) => {
    const { name, part } = splitUnit(unit);
    if (part) return [unit];
    return PARTS[name] ? PARTS[name].parts.map((one) => unitName(name, one.part)) : [name];
  });
}

/** The part's own description: its arguments and engine. */
export const partOf = (name, part) => PARTS[name]?.parts.find((one) => one.part === part) ?? null;

const CLAIM_HOLDERS = ["checks", "claims", "criteria"];
const held = (value) => value === true || (value !== null && typeof value === "object" && !Array.isArray(value) && value.ok !== false && value.passed !== false);

/**
 * The harness's verdict made from its parts' verdicts. A claim holds where
 * it held in every part that made it, and says what each part said; a part
 * that wrote no verdict is a claim of its own that fails
 * (`everyPartWroteAVerdict`), so a part that crashed is never a pass.
 *
 * @param {{ part: string, verdict: object | null }[]} parts
 */
export function mergeParts(parts) {
  const wrote = parts.filter((one) => one.verdict && typeof one.verdict === "object");
  const merged = { at: wrote.map((one) => one.verdict.at).filter(Boolean).sort().at(-1) ?? new Date().toISOString(), parts: parts.map((one) => one.part) };
  for (const holder of CLAIM_HOLDERS) {
    const names = [...new Set(wrote.flatMap((one) => Object.keys(one.verdict[holder] ?? {})))];
    if (names.length === 0) continue;
    merged[holder] = {};
    for (const claim of names) {
      const said = Object.fromEntries(wrote.filter((one) => one.verdict[holder] && claim in one.verdict[holder]).map((one) => [one.part, one.verdict[holder][claim]]));
      merged[holder][claim] = { ok: Object.values(said).every(held), byPart: said };
    }
  }
  const missing = parts.filter((one) => !wrote.includes(one)).map((one) => one.part);
  merged.checks = { ...(merged.checks ?? {}), everyPartWroteAVerdict: { ok: missing.length === 0, ...(missing.length > 0 ? { missing } : {}) } };
  merged.passed = missing.length === 0 && wrote.every((one) => one.verdict.passed !== false && one.verdict.ok !== false) && Object.values(merged.checks).every((check) => check.ok);
  // What each part said beyond its claims (its counts, its definitions), kept under its own name.
  merged.byPart = Object.fromEntries(wrote.map((one) => [one.part, Object.fromEntries(Object.entries(one.verdict).filter(([key]) => ![...CLAIM_HOLDERS, "at", "passed", "ok", "timing"].includes(key)))]));
  return merged;
}

/**
 * Writes the harness's verdict from whichever of its part files there are,
 * when every part has one or `whole` says the run asked for every part,
 * and takes the part files away. Returns the verdict's path, or null when
 * the run took only some of the parts and they are left for another to
 * merge (a shard on GitHub; verify-on-github.mjs merges them there).
 */
export function writeMerged(repoRoot, name, { whole = false, since = 0 } = {}) {
  const spec = PARTS[name];
  if (!spec) return null;
  // A part file older than `since` is an earlier run's, and is no verdict of this one.
  const fresh = (path) => {
    try {
      return statSync(path).mtimeMs >= since;
    } catch {
      return false;
    }
  };
  const files = spec.parts.map(({ part }) => ({ part, path: resolve(repoRoot, partPath(spec.verdict, part)) }));
  if (!whole && !files.every((one) => fresh(one.path))) return null;
  const parts = files.map(({ part, path }) => {
    if (!fresh(path)) return { part, verdict: null };
    try {
      return { part, verdict: JSON.parse(readFileSync(path, "utf8")) };
    } catch {
      return { part, verdict: null };
    }
  });
  writeFileSync(resolve(repoRoot, spec.verdict), `${JSON.stringify(mergeParts(parts), null, 2)}\n`);
  for (const { path } of files) rmSync(path, { force: true });
  return spec.verdict;
}
