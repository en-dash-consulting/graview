/**
 * WHAT THE DEPENDENCIES BRING, SORTED BY WHO RECEIVES IT (HQ feature
 * f-dependency-security-gate).
 *
 * `pnpm audit` names each advisory with one path through the workspace, and
 * only one: a version that a published package and an example both reach is
 * said once, under whichever importer it found first. So the path does not
 * say whether a published package reaches it. That is read here from the
 * packages' own trees instead (`pnpm list --prod`, every published package
 * under packages/): their dependencies and optional dependencies, all the way
 * down. A package's devDependencies do not ship, and its own peer
 * dependencies are installed by whoever installs it, at a version they
 * resolve, so neither counts as reaching it.
 *
 * A high or critical advisory on a version a published package reaches fails
 * the check. Everything else — the examples, the scripts, the dev tooling, a
 * published package's devDependencies — is reported and passes.
 */

/** The severities that fail the check when a published package reaches them. */
export const FAILING = ["high", "critical"];

const SEVERITY_ORDER = ["critical", "high", "moderate", "low", "info"];

/** `name@version`, the one key a tree, an audit and a lockfile share. */
export const keyOf = (name, version) => `${name}@${version}`;

/**
 * Every `name@version` a published package reaches, with the published
 * packages that reach it. `trees` is `pnpm list --prod --depth Infinity
 * --json` over the packages; `manifestOf(path)` reads a project's
 * package.json. A private project is not published; a workspace link is
 * walked as its own tree, not through the package that links it.
 *
 * pnpm prints a version's dependencies once in the whole listing and marks
 * every later appearance `deduped`, with none, whichever tree the first one
 * is in (a peer, a private project). So each version's dependencies are
 * indexed from wherever they were printed, and a deduped one is walked
 * through that.
 */
export function publishedReach(trees, manifestOf) {
  const printed = new Map();
  const index = (deps) => {
    for (const [name, dep] of Object.entries(deps ?? {})) {
      if (!dep.version || dep.deduped) continue;
      const key = keyOf(name, String(dep.version));
      if (!printed.has(key)) printed.set(key, dep);
      index(dep.dependencies);
      index(dep.optionalDependencies);
    }
  };
  for (const tree of trees) {
    index(tree.dependencies);
    index(tree.optionalDependencies);
  }

  const reach = new Map();
  const add = (key, by) => {
    if (!reach.has(key)) reach.set(key, new Set());
    reach.get(key).add(by);
  };
  for (const tree of trees) {
    const manifest = manifestOf(tree.path);
    if (!manifest) throw new Error(`no package.json could be read for ${tree.name ?? tree.path}`);
    if (tree.private || manifest.private) continue;
    const ships = new Set([...Object.keys(manifest.dependencies ?? {}), ...Object.keys(manifest.optionalDependencies ?? {})]);
    const seen = new Set();
    const walk = (deps, top) => {
      for (const [name, dep] of Object.entries(deps ?? {})) {
        // Its own peers are the installer's to resolve.
        if (top && !ships.has(name)) continue;
        const version = String(dep.version ?? "");
        if (version === "" || version.startsWith("link:") || version.startsWith("file:")) continue;
        const key = keyOf(name, version);
        add(key, tree.name);
        if (seen.has(key)) continue;
        seen.add(key);
        const full = dep.deduped ? printed.get(key) : dep;
        if (dep.deduped && !full && dep.dedupedDependenciesCount) throw new Error(`pnpm list printed ${key} as deduped and never in full`);
        walk(full?.dependencies, false);
        walk(full?.optionalDependencies, false);
      }
    };
    walk(tree.dependencies, true);
    walk(tree.optionalDependencies, true);
  }
  return reach;
}

/** Where an audit path starts, said as a directory: `packages__tools>x` is packages/tools. */
export function importerOf(path) {
  const first = String(path).split(">")[0];
  return first === "." ? "the workspace root" : first.replaceAll("__", "/");
}

/**
 * One row per advisory and version found: what it is, how severe, which
 * published packages reach it, where the audit first saw it, and whether it
 * fails the check. Refuses an audit that is not one, rather than pass on an
 * error the registry answered with.
 */
export function findingsOf(audit, reach) {
  if (!audit || typeof audit !== "object" || !audit.advisories || typeof audit.advisories !== "object") {
    const said = audit?.error?.summary ?? audit?.error?.message ?? audit?.message ?? JSON.stringify(audit)?.slice(0, 200);
    throw new Error(`pnpm audit did not answer with advisories: ${said}`);
  }
  const rows = [];
  for (const advisory of Object.values(audit.advisories)) {
    const severity = String(advisory.severity ?? "info");
    for (const finding of advisory.findings ?? []) {
      const key = keyOf(advisory.module_name, finding.version);
      const published = [...(reach.get(key) ?? [])].sort();
      rows.push({
        module: advisory.module_name,
        version: finding.version,
        severity,
        id: advisory.github_advisory_id ?? String(advisory.id),
        url: advisory.url ?? "",
        published,
        seenAt: [...new Set((finding.paths ?? []).map(importerOf))],
        fails: published.length > 0 && FAILING.includes(severity),
      });
    }
  }
  return rows.sort(
    (a, b) =>
      Number(b.fails) - Number(a.fails) ||
      Number(b.published.length > 0) - Number(a.published.length > 0) ||
      SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity) ||
      a.module.localeCompare(b.module) ||
      a.id.localeCompare(b.id),
  );
}

/** Each row that fails, said as a sentence. */
export function failuresOf(rows) {
  return rows
    .filter((row) => row.fails)
    .map((row) => `${row.module}@${row.version} has a ${row.severity} advisory (${row.id}) and ${row.published.join(", ")} ${row.published.length === 1 ? "reaches" : "reach"} it`);
}

/** The counts by severity, published and not. */
export function countsOf(rows) {
  const counts = {};
  for (const severity of SEVERITY_ORDER) counts[severity] = { published: 0, reported: 0 };
  for (const row of rows) {
    counts[row.severity] ??= { published: 0, reported: 0 };
    counts[row.severity][row.published.length > 0 ? "published" : "reported"] += 1;
  }
  return counts;
}

/** The findings as Markdown, for the job's summary and the log. */
export function findingsMarkdown(rows) {
  const counts = countsOf(rows);
  const lines = ["### Advisories", ""];
  const failing = rows.filter((row) => row.fails).length;
  lines.push(
    failing === 0
      ? "No high or critical advisory reaches a published package."
      : `${failing} high or critical ${failing === 1 ? "advisory reaches" : "advisories reach"} a published package. The check fails.`,
    "",
    "| Severity | Reaching a published package | Elsewhere (reported only) |",
    "|---|---:|---:|",
  );
  for (const severity of SEVERITY_ORDER) {
    const { published, reported } = counts[severity];
    if (published + reported > 0) lines.push(`| ${severity} | ${published} | ${reported} |`);
  }
  if (rows.length === 0) return [...lines, "", "The audit found nothing."].join("\n");
  lines.push("", "| | Package | Severity | Advisory | Published packages reaching it | Audit's first path starts at |", "|---|---|---|---|---|---|");
  for (const row of rows) {
    const advisory = row.url ? `[${row.id}](${row.url})` : row.id;
    lines.push(
      `| ${row.fails ? "FAIL" : row.published.length > 0 ? "ships" : ""} | ${row.module}@${row.version} | ${row.severity} | ${advisory} | ${row.published.join(", ") || "none"} | ${row.seenAt.join(", ")} |`,
    );
  }
  return lines.join("\n");
}

/**
 * The versions a pnpm lockfile (v9) resolves, by package: the keys of its
 * `packages:` section, `name@version` or `'@scope/name@version'`.
 */
export function lockfileVersions(text) {
  const versions = new Map();
  const start = text.indexOf("\npackages:\n");
  if (start < 0) return versions;
  const rest = text.slice(start + "\npackages:\n".length);
  const end = rest.search(/\n\S/);
  for (const line of (end < 0 ? rest : rest.slice(0, end)).split("\n")) {
    const match = /^ {2}'?((?:@[^@/'\s]+\/)?[^@'\s]+)@([^'\s]+?)'?:$/.exec(line);
    if (!match) continue;
    if (!versions.has(match[1])) versions.set(match[1], new Set());
    versions.get(match[1]).add(match[2]);
  }
  return versions;
}

/** The packages whose resolved versions differ between two lockfiles, by name. */
export function lockfileChanges(beforeText, afterText) {
  const before = lockfileVersions(beforeText);
  const after = lockfileVersions(afterText);
  const changes = [];
  for (const name of [...new Set([...before.keys(), ...after.keys()])].sort()) {
    const was = [...(before.get(name) ?? [])].sort();
    const is = [...(after.get(name) ?? [])].sort();
    if (was.join(",") !== is.join(",")) changes.push({ name, before: was, after: is });
  }
  return changes;
}

/** The changed versions as Markdown, against the ref they were compared to. */
export function changesMarkdown(changes, base) {
  const lines = [`### Lockfile versions changed against \`${base}\``, ""];
  if (changes.length === 0) return [...lines, "None."].join("\n");
  lines.push("| Package | Before | After |", "|---|---|---|");
  for (const change of changes) lines.push(`| ${change.name} | ${change.before.join(", ") || "—"} | ${change.after.join(", ") || "—"} |`);
  return lines.join("\n");
}

/**
 * Every `name@version` npm's tree (`npm ls --all --json`) shows, deduped
 * entries and all, save an extraneous one: npm checks a package's signature
 * through a dependency that reaches it, and nothing reaches one of those.
 */
export function seenByNpm(npmTree) {
  const seen = new Set();
  const walk = (deps) => {
    for (const [name, dep] of Object.entries(deps ?? {})) {
      if (dep.version && !dep.extraneous && !String(dep.version).startsWith("link:") && !String(dep.version).startsWith("file:")) seen.add(keyOf(name, dep.version));
      walk(dep.dependencies);
    }
  };
  walk(npmTree?.dependencies);
  return seen;
}

/**
 * What `npm audit signatures` would have skipped without saying so: each
 * package installed on disk that npm's tree did not show it, and how many the
 * lockfile holds that this machine did not install (another platform's).
 */
export function unseenByNpm(installed, npmTree, lockText) {
  const seen = seenByNpm(npmTree);
  const unseen = [...installed].filter((key) => !seen.has(key)).sort();
  let notInstalled = 0;
  for (const [name, versions] of lockfileVersions(lockText)) for (const version of versions) if (!installed.has(keyOf(name, version))) notInstalled += 1;
  return { installed: installed.size, seen: seen.size, unseen, notInstalled };
}
