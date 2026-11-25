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
import { mergeJourneys } from "./journeys-verdict.mjs";

export const PART_ENV = "GRAVIEW_PART";

/** The harnesses run in parts: each part's name, its arguments, the engine whose watch it writes, and the verdict the parts make. */
const byEngine = (verdict, engines = ["chromium", "webkit", "firefox"]) => ({ verdict, parts: engines.map((engine) => ({ part: engine, args: [`--engine=${engine}`], engine })) });

/**
 * A harness whose parts are steps of one engine: each part takes the steps
 * named (a name, or every name under it: `phone` is `phone/button` and the
 * rest of the phone's), and the part called `rest` takes every step no other
 * part does — so a step added to the harness later is run by `rest` and
 * never by nobody. The harness chooses its steps with `chooseSteps`.
 */
const bySteps = (verdict, taken, more = {}) => ({
  verdict,
  ...more,
  parts: [
    ...Object.entries(taken).map(([part, steps]) => ({ part, args: [`--steps=${steps.join(",")}`], engine: "chromium" })),
    { part: "rest", args: [`--not=${Object.values(taken).flat().join(",")}`], engine: "chromium" },
  ],
});

const under = (name, pattern) => name === pattern || name.startsWith(`${pattern}/`);

/**
 * The steps a run takes of a harness's own, each `{ name, … }`: those
 * `--steps` names, or all but those `--not` names, or every one. A name that
 * is no step's throws, since the steps it was meant to name would be run by
 * no part. `--list-steps` prints the names this run would take and ends.
 */
export function chooseSteps(steps, argv = process.argv.slice(2)) {
  const said = (flag) => argv.find((arg) => arg.startsWith(`${flag}=`))?.slice(flag.length + 1).split(",").filter(Boolean) ?? null;
  const take = said("--steps");
  const leave = said("--not");
  const lost = [...(take ?? []), ...(leave ?? [])].filter((pattern) => !steps.some((step) => under(step.name, pattern)));
  if (lost.length > 0) throw new Error(`No step called ${lost.join(", ")}. Known: ${steps.map((step) => step.name).join(", ")}`);
  const chosen = steps.filter((step) => (!take || take.some((one) => under(step.name, one))) && !leave?.some((one) => under(step.name, one)));
  if (argv.includes("--list-steps")) {
    process.stdout.write(`${chosen.map((step) => step.name).join("\n")}\n`);
    process.exit(0);
  }
  return chosen;
}

export const PARTS = {
  /* The next longest, each an engine at a time with nothing shared between engines: 627 s, 623 s and 386 s on a laptop. */
  address: byEngine("docs/address.json"),
  "scene-hands": byEngine("docs/scene-hands.json", ["chromium", "webkit"]),
  "drawn-once": byEngine("docs/drawn-once.json"),
  /*
   * The longest three left: 1,005 s, 525 s and 677 s on a runner, where a
   * shard's set-up is another two and a half minutes and a second look as
   * long again. Journeys by app, and Gauntlet, a third of it, by face: a
   * job's pointer and keyboard are compared within a face. `rest` is the
   * apps no other part names.
   */
  journeys: bySteps("docs/journeys.json", { todo: ["todo"], seedbed: ["seedbed"], discography: ["discography", "discography-past"], "gauntlet-scene": ["gauntlet/scene"], "gauntlet-pages": ["gauntlet/pages"] }, { merge: mergeJourneys }),
  site: bySteps("docs/site-check.json", { page: ["sweep/index.html"], tour: ["sweep/tour.html"], "progression-light": ["sweep/progression.html/light"], "progression-dark": ["sweep/progression.html/dark"] }),
  "one-face": bySteps("docs/one-face.json", {
    desk: ["desk/switch", "desk/button", "desk/node", "desk/views", "desk/chosen", "desk/free", "desk/overshoot", "desk/bar", "desk/viewLines"],
    phone: ["phone"],
    rich: ["rich", "richPhoneLines"],
  }),
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
  /*
   * A CLAIM NO PART MADE. A part says which of the harness's claims it had
   * nothing to judge (`unmade`): another part's steps are what they are
   * about. One that every part left is a claim the whole would have failed
   * for want of anything seen, and fails here too.
   */
  for (const claim of new Set(wrote.flatMap((one) => one.verdict.unmade ?? [])))
    if (!CLAIM_HOLDERS.some((holder) => merged[holder] && claim in merged[holder])) merged.checks[claim] = { ok: false, unmade: merged.parts };
  merged.passed = missing.length === 0 && wrote.every((one) => one.verdict.passed !== false && one.verdict.ok !== false) && Object.values(merged.checks).every((check) => check.ok);
  // What each part said beyond its claims (its counts, its definitions), kept under its own name.
  merged.byPart = Object.fromEntries(wrote.map((one) => [one.part, Object.fromEntries(Object.entries(one.verdict).filter(([key]) => ![...CLAIM_HOLDERS, "at", "passed", "ok", "timing", "unmade"].includes(key)))]));
  return merged;
}

/**
 * What a merged verdict says failed that no part said: a claim none of them
 * made, or one only the whole can judge. The parts all held, so the harness
 * fails by these, as the one process it was would have.
 */
export function missedByTheWhole(repoRoot, name) {
  const path = resolve(repoRoot, PARTS[name].verdict);
  const verdict = existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : null;
  if (!verdict?.parts || verdict.passed !== false) return [];
  const missed = CLAIM_HOLDERS.flatMap((holder) => Object.entries(verdict[holder] ?? {}).filter(([, value]) => !held(value)).map(([claim]) => claim));
  return missed.length > 0 ? missed : ["its parts held and its verdict does not pass"];
}

/**
 * Writes the harness's verdict from whichever of its part files there are,
 * when every part has one or `whole` says the run asked for every part,
 * and takes the part files away. Returns the verdict's path, or null when
 * the run took only some of the parts and they are left for another to
 * merge (a shard on GitHub; verify-on-github.mjs merges them there).
 */
export function writeMerged(repoRoot, name, { whole = false, since = 0, only = null } = {}) {
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
  // `only`: the parts a run took by design (--quick takes one engine's), the verdict made from those alone.
  const files = spec.parts.filter(({ part }) => !only || only.includes(part)).map(({ part }) => ({ part, path: resolve(repoRoot, partPath(spec.verdict, part)) }));
  if (!whole && !files.every((one) => fresh(one.path))) return null;
  const parts = files.map(({ part, path }) => {
    if (!fresh(path)) return { part, verdict: null };
    try {
      return { part, verdict: JSON.parse(readFileSync(path, "utf8")) };
    } catch {
      return { part, verdict: null };
    }
  });
  writeFileSync(resolve(repoRoot, spec.verdict), `${JSON.stringify((spec.merge ?? mergeParts)(parts), null, 2)}\n`);
  for (const { path } of files) rmSync(path, { force: true });
  return spec.verdict;
}
