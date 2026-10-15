import { accessSync, constants, existsSync, readdirSync, readFileSync, realpathSync, statSync } from "node:fs";
import { basename, delimiter, dirname, join, relative, resolve, sep } from "node:path";
import { FORMAT, FORMAT_VERSION } from "../document/schema.js";
import { FRAMEWORK_VERSION } from "../version.js";

/**
 * `graview doctor` — WHETHER A PRODUCT'S GRAVIEW IS ONE RELEASE.
 *
 * One release is named five times in a product: `@graview/core`, `/pages`,
 * `/ship` and the rest in package.json, `graview` beside them, what the
 * lockfile resolved each to, what is installed, and the `formatVersion` of
 * every declaration document. And React's pair: React 19.3 refuses a
 * `react` beside a `react-dom` of another version at startup, which a
 * person meets as a blank page. Each of these drifted apart in a product
 * built from outside (n-dx's face) and was found by what broke; this says
 * each as a sentence with its fix, and exits 1 on any problem.
 */
export const DOCTOR_USAGE = `  graview doctor [<dir>] [--document <file>] [--json]
      Says whether the product in <dir> (default .) is on one Graview
      release: every graview and @graview/* pin in its package.json the same
      version, its lockfile and its node_modules holding that version, each
      declaration document's formatVersion one the installed core reads, and
      react beside react-dom at one version (React refuses a mismatched pair
      at startup, and the page is blank). Run from a framework checkout with
      no graview on PATH, it says how to put it there. Each problem is said with its fix;
      exits 1 on any.
`;

export type DoctorLevel = "ok" | "note" | "problem";

export interface DoctorFinding {
  readonly level: DoctorLevel;
  /** What is so, as a sentence. */
  readonly says: string;
  /** What to do about it, as a sentence, when there is something to do. */
  readonly fix?: string;
}

const SECTIONS = ["dependencies", "devDependencies", "optionalDependencies"] as const;
const isFramework = (name: string): boolean => name === "graview" || name.startsWith("@graview/");
/** A version a range names: `0.1.20` in `0.1.20`, `^0.1.20`, `~0.1.20`, `>=0.1.20`. */
const named = (range: string): string | undefined => /\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?/.exec(range)?.[0];
/** A range that is a checkout on disk rather than a release: nothing to hold to a version. */
const linked = (range: string): boolean => /^(?:workspace|link|file|portal):/.test(range);
const exact = (range: string): boolean => /^=?v?\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(range.trim());

function readJson(file: string): Record<string, unknown> | undefined {
  try {
    const parsed = JSON.parse(readFileSync(file, "utf8")) as unknown;
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : undefined;
  } catch {
    return undefined;
  }
}

/** Where Node would find a package from `dir`: the nearest `node_modules/<name>`, walking up. Its exports may hide `./package.json`, so the folder is read directly. */
export function installedVersion(dir: string, name: string): { readonly version: string; readonly at: string } | undefined {
  let here = resolve(dir);
  for (;;) {
    const at = join(here, "node_modules", name, "package.json");
    if (existsSync(at)) {
      const version = readJson(at)?.["version"];
      if (typeof version === "string") return { version, at: dirname(at) };
    }
    const up = dirname(here);
    if (up === here) return undefined;
    here = up;
  }
}

/** The lockfile that decides what `dir` installs: the nearest one, walking up. */
function lockfileOf(dir: string): { readonly file: string; readonly manager: string } | undefined {
  let here = resolve(dir);
  for (;;) {
    for (const [name, manager] of [
      ["pnpm-lock.yaml", "pnpm"],
      ["package-lock.json", "npm"],
      ["yarn.lock", "yarn"],
      ["bun.lock", "bun"],
    ] as const) {
      if (existsSync(join(here, name))) return { file: join(here, name), manager };
    }
    const up = dirname(here);
    if (up === here) return undefined;
    here = up;
  }
}

/** Every version of every Graview package a lockfile resolves, by package. */
export function lockedVersions(file: string): Map<string, Set<string>> {
  const found = new Map<string, Set<string>>();
  const add = (name: string, version: string) => {
    if (!isFramework(name)) return;
    (found.get(name) ?? found.set(name, new Set()).get(name)!).add(version);
  };
  const text = readFileSync(file, "utf8");
  if (file.endsWith(".json")) {
    const packages = (JSON.parse(text) as { packages?: Record<string, { version?: string; link?: boolean }> }).packages ?? {};
    for (const [path, entry] of Object.entries(packages)) {
      const name = /(?:^|\/)node_modules\/((?:@graview\/)?[^/]+)$/.exec(path)?.[1];
      if (name && typeof entry.version === "string" && !entry.link) add(name, entry.version);
    }
    return found;
  }
  if (basename(file) === "yarn.lock") {
    let current: string[] = [];
    for (const line of text.split("\n")) {
      if (!line.startsWith(" ") && line.trim().endsWith(":")) {
        current = [...line.matchAll(/"?((?:@graview\/)?[\w-]+)@/g)].map((match) => match[1]!).filter(isFramework);
        continue;
      }
      const version = /^\s+version:?\s+"?([^"\s]+)"?/.exec(line)?.[1];
      if (version && current.length > 0) for (const name of current) add(name, version);
    }
    return found;
  }
  // pnpm (v5–v9) and bun: `'@graview/core@0.1.20':`, `/@graview/core/0.1.20:`, `graview@0.1.20(…)`.
  for (const match of text.matchAll(/^\s+['"]?\/?((?:@graview\/)?[\w-]+)[@/](\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)/gm)) add(match[1]!, match[2]!);
  return found;
}

/** The documents in a product: `.json` files that say they are Graview declarations, outside what is installed or built. */
function documentsIn(dir: string, depth = 4): string[] {
  const found: string[] = [];
  const walk = (here: string, left: number) => {
    let entries: string[];
    try {
      entries = readdirSync(here);
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.startsWith(".") || ["node_modules", "dist", "build", "coverage", "out"].includes(entry)) continue;
      const path = join(here, entry);
      let stat;
      try {
        stat = statSync(path);
      } catch {
        continue;
      }
      if (stat.isDirectory()) {
        if (left > 0) walk(path, left - 1);
      } else if (entry.endsWith(".json") && entry !== "package.json" && entry !== "package-lock.json" && stat.size < 8 * 1024 * 1024) {
        if (readJson(path)?.["format"] === FORMAT) found.push(path);
      }
    }
  };
  walk(resolve(dir), depth);
  return found.sort();
}

/** The format version the core installed in `dir` reads, from its built schema — or this CLI's own when none is installed. */
function coreFormatVersion(dir: string): { readonly version: number; readonly from: string } {
  const core = installedVersion(dir, "@graview/core");
  if (core) {
    try {
      const said = /FORMAT_VERSION\s*=\s*(\d+)/.exec(readFileSync(join(core.at, "dist", "document", "schema.js"), "utf8"))?.[1];
      if (said) return { version: Number(said), from: `the installed @graview/core ${core.version}` };
    } catch {
      // An install without its built schema: fall back to this CLI's own.
    }
  }
  return { version: FORMAT_VERSION, from: `this graview's own @graview/core ${FRAMEWORK_VERSION}` };
}

const listed = (names: readonly string[]) => (names.length <= 2 ? names.join(" and ") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`);

/** The framework checkout a `graview` script runs from, when it is one: the folder holding `pnpm-workspace.yaml` and `packages/graview`. */
export function checkoutOf(cli: string | undefined): string | undefined {
  if (!cli) return undefined;
  let script: string;
  try {
    script = realpathSync(cli);
  } catch {
    return undefined;
  }
  if (script.split(sep).includes("node_modules")) return undefined;
  // <checkout>/packages/graview/dist/cli.js
  const checkout = resolve(dirname(script), "..", "..", "..");
  return existsSync(join(checkout, "pnpm-workspace.yaml")) && existsSync(join(checkout, "packages", "graview", "package.json")) ? checkout : undefined;
}

/** Whether a command is on a PATH: an executable file of that name in one of its folders. */
export function onPath(command: string, path: string | undefined): boolean {
  const names = process.platform === "win32" ? [`${command}.cmd`, `${command}.exe`, command] : [command];
  return (path ?? "")
    .split(delimiter)
    .filter(Boolean)
    .some((folder) =>
      names.some((name) => {
        try {
          accessSync(join(folder, name), constants.X_OK);
          return statSync(join(folder, name)).isFile();
        } catch {
          return false;
        }
      }),
    );
}

/**
 * A GRAVIEW RUN FROM A CHECKOUT, WITH NO `graview` ON PATH. On a machine
 * with the framework checked out and nothing published installed, the
 * command was `node <checkout>/packages/graview/dist/cli.js`, every time,
 * and nothing said there was a shorter way. Said once, with the one line
 * that puts it on PATH.
 */
export function checkoutFindings(options: { readonly cli?: string; readonly path?: string } = {}): DoctorFinding[] {
  const checkout = checkoutOf(options.cli ?? process.argv[1]);
  if (!checkout || onPath("graview", options.path ?? process.env["PATH"])) return [];
  return [
    {
      level: "note",
      says: `This graview runs from the checkout at ${checkout}, and there is no graview command on PATH.`,
      fix: `Put it there once: pnpm graview:link in ${checkout} (pnpm link --global for packages/graview; run pnpm setup first if pnpm has no global bin folder). Until then: node ${join(checkout, "packages", "graview", "dist", "cli.js")} <command>.`,
    },
  ];
}

/** What the doctor finds in a product's directory. Reads the disk; writes nothing. */
export function diagnose(dir: string, options: { readonly documents?: readonly string[]; readonly cli?: string; readonly path?: string } = {}): DoctorFinding[] {
  const findings: DoctorFinding[] = [...checkoutFindings(options)];
  const root = resolve(dir);
  const manifest = readJson(join(root, "package.json"));
  if (!manifest) {
    return [...findings, { level: "problem", says: `There is no package.json in ${root}.`, fix: "Run graview doctor in the product's own directory, or name it: graview doctor <dir>." }];
  }
  const lock = lockfileOf(root);
  const install = `${lock?.manager ?? "npm"} install`;

  /* ---- the pins */
  const pins = new Map<string, string>();
  for (const section of SECTIONS) {
    const deps = manifest[section];
    if (typeof deps !== "object" || deps === null) continue;
    for (const [name, range] of Object.entries(deps as Record<string, unknown>)) if (isFramework(name) && typeof range === "string") pins.set(name, range);
  }
  const released = [...pins].filter(([, range]) => !linked(range));
  const links = [...pins].filter(([, range]) => linked(range)).map(([name]) => name);
  if (links.length > 0) findings.push({ level: "note", says: `${listed(links)} ${links.length === 1 ? "is" : "are"} named by a path (a checkout, a workspace or a tarball) rather than a release, so no version is held to for ${links.length === 1 ? "it" : "them"}.` });
  const byVersion = new Map<string, string[]>();
  for (const [name, range] of released) {
    const version = named(range) ?? range;
    (byVersion.get(version) ?? byVersion.set(version, []).get(version)!).push(name);
  }
  const versions = [...byVersion.entries()].sort((a, b) => b[1].length - a[1].length);
  const release = versions[0]?.[0];
  if (pins.size === 0) {
    findings.push({ level: "note", says: "package.json names no graview or @graview/* package." });
  } else if (versions.length > 1) {
    findings.push({
      level: "problem",
      says: `package.json names ${versions.length} Graview releases: ${versions.map(([version, names]) => `${version} (${listed(names)})`).join("; ")}.`,
      fix: `Every @graview/* package and graview are one release: pin them all to ${release} and run ${install}.`,
    });
  } else if (release) {
    findings.push({ level: "ok", says: `package.json pins ${released.length} Graview package${released.length === 1 ? "" : "s"} to ${release}.` });
    const loose = released.filter(([, range]) => !exact(range)).map(([name]) => name);
    if (loose.length > 0)
      findings.push({
        level: "note",
        says: `${listed(loose)} ${loose.length === 1 ? "is" : "are"} pinned by a range, so one install can resolve them to different releases.`,
        fix: `Pin each to exactly ${release}.`,
      });
  }

  /* ---- what is installed */
  for (const [name, range] of released) {
    const wanted = named(range);
    const installed = installedVersion(root, name);
    if (!installed) {
      findings.push({ level: "problem", says: `${name} is in package.json but not installed.`, fix: `Run ${install}.` });
    } else if (wanted && exact(range) && installed.version !== wanted) {
      findings.push({ level: "problem", says: `package.json pins ${name} ${wanted}, and ${installed.version} is installed.`, fix: `Run ${install}.` });
    }
  }
  const installedReleases = new Map<string, string[]>();
  for (const [name] of released) {
    const installed = installedVersion(root, name);
    if (installed) (installedReleases.get(installed.version) ?? installedReleases.set(installed.version, []).get(installed.version)!).push(name);
  }
  if (installedReleases.size > 1) {
    findings.push({
      level: "problem",
      says: `node_modules holds ${installedReleases.size} Graview releases: ${[...installedReleases].map(([version, names]) => `${version} (${listed(names)})`).join("; ")}.`,
      fix: `Pin every @graview/* package and graview to one version and run ${install}; two releases side by side make every kind a different type and every act a different function.`,
    });
  }

  /* ---- the lockfile */
  if (lock && released.length > 0) {
    const locked = lockedVersions(lock.file);
    const where = relative(root, lock.file) || basename(lock.file);
    const all = new Set([...locked.values()].flatMap((set) => [...set]));
    for (const [name, range] of released) {
      const wanted = named(range);
      const has = locked.get(name);
      if (wanted && exact(range) && has && !has.has(wanted)) {
        findings.push({ level: "problem", says: `${where} resolves ${name} to ${[...has].join(" and ")}, and package.json pins ${wanted}.`, fix: `Run ${install} so the lockfile follows package.json.` });
      }
    }
    if (all.size > 1) {
      findings.push({
        level: "problem",
        says: `${where} holds ${all.size} Graview releases (${[...all].sort().join(", ")}): a second copy of a package is installed beside the first.`,
        fix: `Pin every @graview/* package and graview to one version wherever this lockfile's projects name them, and run ${install}.`,
      });
    } else if (all.size === 1) {
      findings.push({ level: "ok", says: `${where} holds one Graview release, ${[...all][0]}.` });
    }
  }

  /* ---- this graview */
  if (release && named(release) && named(release) !== FRAMEWORK_VERSION) {
    findings.push({
      level: "note",
      says: `This graview is ${FRAMEWORK_VERSION}, and the product pins ${release}.`,
      fix: "Run the product's own: node_modules/.bin/graview (pnpm exec graview, npx --no-install graview), which is the release it checks against.",
    });
  }

  /* ---- the documents */
  const documents = options.documents?.map((file) => resolve(root, file)) ?? documentsIn(root);
  const core = coreFormatVersion(root);
  for (const file of documents) {
    const name = relative(root, file) || basename(file);
    const document = readJson(file);
    if (!document) {
      findings.push({ level: "problem", says: `${name} is not a JSON object.`, fix: "Check that the file is the declaration document and that it parses." });
      continue;
    }
    const version = document["formatVersion"];
    if (typeof version !== "number") {
      findings.push({ level: "problem", says: `${name} says no formatVersion.`, fix: `Add "formatVersion": ${core.version}, the version ${core.from} reads.` });
    } else if (version > core.version) {
      findings.push({
        level: "problem",
        says: `${name} is format version ${version}, and ${core.from} reads up to ${core.version}.`,
        fix: "Move every @graview/* package and graview to the release that wrote it, or write the document for this one.",
      });
    } else if (version < core.version) {
      findings.push({ level: "note", says: `${name} is format version ${version}; ${core.from} reads ${core.version} and upgrades it as it compiles.`, fix: "Write it at the current version when you next change it." });
    } else {
      findings.push({ level: "ok", says: `${name} is format version ${version}, which ${core.from} reads.` });
    }
  }

  /* ---- React's pair */
  const react = installedVersion(root, "react");
  const reactDom = installedVersion(root, "react-dom");
  const range = (name: string) => SECTIONS.map((section) => (manifest[section] as Record<string, string> | undefined)?.[name]).find((one) => typeof one === "string");
  if (react && reactDom) {
    if (react.version !== reactDom.version) {
      findings.push({
        level: "problem",
        says: `react ${react.version} is installed beside react-dom ${reactDom.version}: React refuses a mismatched pair at startup, and the page is blank.`,
        fix: `Pin both to one version ("react": "${reactDom.version}", "react-dom": "${reactDom.version}") and run ${install}.`,
      });
    } else {
      findings.push({ level: "ok", says: `react and react-dom are both ${react.version}.` });
    }
  } else if (range("react") && range("react-dom")) {
    const [a, b] = [range("react")!, range("react-dom")!];
    if (named(a) !== named(b)) {
      findings.push({
        level: exact(a) && exact(b) ? "problem" : "note",
        says: `package.json asks for react ${a} and react-dom ${b}, and neither is installed yet: React refuses a pair of different versions at startup.`,
        fix: `Ask for the same version of both, then run ${install}.`,
      });
    }
  }
  return findings;
}

const MARK: Readonly<Record<DoctorLevel, string>> = { ok: "✓", note: "·", problem: "✗" };

export function doctor(argv: readonly string[]): number {
  const at = (name: string) => {
    const index = argv.indexOf(name);
    return index === -1 ? undefined : argv[index + 1];
  };
  const document = at("--document");
  const dir = argv.find((arg, index) => !arg.startsWith("--") && argv[index - 1] !== "--document") ?? ".";
  const findings = diagnose(dir, document ? { documents: [document] } : {});
  const problems = findings.filter((finding) => finding.level === "problem").length;
  if (argv.includes("--json")) {
    process.stdout.write(`${JSON.stringify({ ok: problems === 0, findings }, null, 2)}\n`);
    return problems === 0 ? 0 : 1;
  }
  for (const finding of findings) process.stdout.write(`${MARK[finding.level]} ${finding.says}${finding.fix ? `\n  ${finding.fix}` : ""}\n`);
  process.stdout.write(problems === 0 ? "graview doctor: one release, nothing to fix.\n" : `graview doctor: ${problems} problem${problems === 1 ? "" : "s"} to fix.\n`);
  return problems === 0 ? 0 : 1;
}
