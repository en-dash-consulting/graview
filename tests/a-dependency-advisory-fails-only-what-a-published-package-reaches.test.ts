import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  changesMarkdown,
  countsOf,
  failuresOf,
  findingsMarkdown,
  findingsOf,
  importerOf,
  lockfileChanges,
  lockfileVersions,
  publishedReach,
  seenByNpm,
  unseenByNpm,
  // @ts-expect-error — a plain .mjs module, without types.
} from "../scripts/lib/dependency-check.mjs";

/**
 * A DEPENDENCY ADVISORY FAILS ONLY WHAT A PUBLISHED PACKAGE REACHES (HQ
 * feature f-dependency-security-gate). `pnpm audit` names one path for each
 * finding, so a version a published package and an example share can be said
 * under the example alone; the check reads the published packages' own trees
 * instead. A published package's devDependencies and its own peers do not
 * ship, and the examples, scripts and dev tooling are reported, not failed.
 */
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const fixture = (name: string) => JSON.parse(readFileSync(resolve(root, "scripts/fixtures/dependency-check", name), "utf8"));
const audit = fixture("audit.json");
const manifests = fixture("manifests.json") as Record<string, unknown>;
const reach = publishedReach(fixture("list.json"), (path: string) => manifests[path]);

type Row = { module: string; version: string; severity: string; id: string; published: string[]; seenAt: string[]; fails: boolean };
const rows = findingsOf(audit, reach) as Row[];
const row = (module: string) => rows.find((one) => one.module === module)!;

describe("what a published package reaches", () => {
  it("is its dependencies all the way down, read from its own tree rather than the audit's one path", () => {
    expect([...reach.get("zod@4.6.5")]).toEqual(["@graview/core"]);
    expect([...reach.get("ip-address@10.7.3")]).toEqual(["@graview/ship"]);
    expect(reach.has("@remote-dom/core@1.12.0")).toBe(true);
  });

  it("walks a version pnpm printed as deduped through where it printed it in full, though that was under another package's peer", () => {
    expect([...reach.get("a-router@2.0.0")]).toEqual(["@graview/guest"]);
    expect([...reach.get("cookie-es@3.1.1")]).toEqual(["@graview/guest"]);
  });

  it("refuses a project whose package.json cannot be read rather than say it reaches nothing", () => {
    expect(() => publishedReach(fixture("list.json"), () => null)).toThrow(/no package.json could be read for @graview\/core/);
  });

  it("leaves out its own peers, which whoever installs it resolves, and a private project's tree", () => {
    expect(reach.has("better-sqlite3@13.0.3")).toBe(false);
    expect(reach.has("node-addon-api@8.9.2")).toBe(false);
    expect(reach.has("playwright@1.49.1")).toBe(false);
    expect(reach.has("tinypool@1.1.1")).toBe(false);
  });

  it("says where an audit path starts as a directory", () => {
    expect(importerOf("packages__tools>@modelcontextprotocol/sdk>hono")).toBe("packages/tools");
    expect(importerOf(".>vitest>tinypool")).toBe("the workspace root");
    expect(importerOf("apps__discography>zod")).toBe("apps/discography");
  });
});

describe("the check", () => {
  it("fails a high advisory a published package reaches, though the audit saw it only under an example", () => {
    expect(row("zod")).toMatchObject({ severity: "high", id: "GHSA-mrhx-c7xc-m3w5", published: ["@graview/core"], seenAt: ["apps/discography"], fails: true });
    expect(failuresOf(rows)).toEqual(["zod@4.6.5 has a high advisory (GHSA-mrhx-c7xc-m3w5) and @graview/core reaches it"]);
  });

  it("reports without failing a high advisory reached only through a published package's devDependency or its peer", () => {
    expect(row("body-parser")).toMatchObject({ severity: "high", published: [], seenAt: ["packages/tools"], fails: false });
    expect(row("playwright")).toMatchObject({ severity: "high", published: [], fails: false });
  });

  it("reports without failing a critical advisory only the dev tooling reaches, and a moderate one a published package does", () => {
    expect(row("tinypool")).toMatchObject({ severity: "critical", published: [], seenAt: ["the workspace root"], fails: false });
    expect(row("ip-address")).toMatchObject({ severity: "moderate", published: ["@graview/ship"], fails: false });
  });

  it("passes an audit with nothing high or critical reaching a published package", () => {
    const clean = { ...audit, advisories: Object.fromEntries(Object.entries(audit.advisories).filter(([, one]) => (one as { module_name: string }).module_name !== "zod")) };
    expect(failuresOf(findingsOf(clean, reach))).toEqual([]);
  });

  it("refuses an answer that is not an audit rather than pass on it", () => {
    expect(() => findingsOf({ error: { code: "ERR_PNPM_AUDIT_BAD_RESPONSE", message: "The audit endpoint responded with 503" } }, reach)).toThrow(/503/);
    expect(() => findingsOf(null, reach)).toThrow(/did not answer with advisories/);
  });

  it("prints a table of what it found, the failing first, counted by severity, published and not", () => {
    expect(countsOf(rows)).toMatchObject({ critical: { published: 0, reported: 1 }, high: { published: 1, reported: 2 }, moderate: { published: 1, reported: 1 } });
    const table = findingsMarkdown(rows);
    expect(table).toContain("1 high or critical advisory reaches a published package. The check fails.");
    expect(table).toContain("| high | 1 | 2 |");
    expect(table.indexOf("| FAIL | zod@4.6.5 | high |")).toBeGreaterThan(table.indexOf("| Severity |"));
    expect(table.indexOf("| FAIL | zod@4.6.5")).toBeLessThan(table.indexOf("tinypool@1.1.1"));
    expect(table).toContain("[GHSA-5gmw-xhrv-c9v3](https://github.com/advisories/GHSA-5gmw-xhrv-c9v3)");
    expect(findingsMarkdown([])).toContain("No high or critical advisory reaches a published package.");
  });
});

describe("the lockfile versions changed", () => {
  const before = [
    "lockfileVersion: '9.0'",
    "",
    "importers:",
    "",
    "  .: {}",
    "",
    "packages:",
    "",
    "  '@hono/node-server@2.1.3':",
    "    resolution: {integrity: sha512-a}",
    "",
    "  hono@4.13.12:",
    "    resolution: {integrity: sha512-b}",
    "",
    "  semver@6.3.1:",
    "    resolution: {integrity: sha512-c}",
    "",
    "  semver@7.8.5:",
    "    resolution: {integrity: sha512-d}",
    "",
    "  left-pad@1.3.0:",
    "    resolution: {integrity: sha512-e}",
    "",
    "snapshots:",
    "",
    "  hono@4.13.12: {}",
    "",
  ].join("\n");
  const after = before
    .replace("'@hono/node-server@2.1.3':", "'@hono/node-server@2.1.7':")
    .replace("  hono@4.13.12:\n    resolution", "  hono@4.13.18:\n    resolution")
    .replace("  left-pad@1.3.0:\n    resolution: {integrity: sha512-e}\n\n", "  tiny@1.0.0:\n    resolution: {integrity: sha512-f}\n\n");

  it("reads each package's resolved versions from the packages section, scoped names and several versions too", () => {
    const versions = lockfileVersions(before);
    expect([...versions.get("@hono/node-server")]).toEqual(["2.1.3"]);
    expect([...versions.get("semver")]).toEqual(["6.3.1", "7.8.5"]);
    expect(versions.has(".")).toBe(false);
  });

  it("names each package whose versions moved, came or went, and prints them for the job's summary", () => {
    const changes = lockfileChanges(before, after);
    expect(changes).toEqual([
      { name: "@hono/node-server", before: ["2.1.3"], after: ["2.1.7"] },
      { name: "hono", before: ["4.13.12"], after: ["4.13.18"] },
      { name: "left-pad", before: ["1.3.0"], after: [] },
      { name: "tiny", before: [], after: ["1.0.0"] },
    ]);
    const table = changesMarkdown(changes, "origin/main");
    expect(table).toContain("### Lockfile versions changed against `origin/main`");
    expect(table).toContain("| hono | 4.13.12 | 4.13.18 |");
    expect(table).toContain("| tiny | — | 1.0.0 |");
    expect(changesMarkdown([], "origin/main")).toContain("None.");
  });

  it("says whether npm saw every installed package it was to check the signature of", () => {
    const tree = {
      dependencies: {
        hono: { version: "4.13.18" },
        "@graview/core": { version: "link:packages/core", dependencies: { semver: { version: "7.8.5" } } },
        "left-pad": { version: "1.3.0", extraneous: true },
      },
    };
    expect([...seenByNpm(tree)].sort()).toEqual(["hono@4.13.18", "semver@7.8.5"]);
    const installed = new Set(["hono@4.13.18", "semver@7.8.5", "left-pad@1.3.0"]);
    expect(unseenByNpm(installed, tree, after)).toEqual({ installed: 3, seen: 2, unseen: ["left-pad@1.3.0"], notInstalled: 3 });
  });
});

describe("where it runs", () => {
  const ci = readFileSync(resolve(root, ".github/workflows/ci.yml"), "utf8");
  const release = readFileSync(resolve(root, ".github/workflows/release.yml"), "utf8");
  const job = ci.slice(ci.indexOf("\n  dependencies:"), ci.indexOf("\n  changeset:"));
  const publish = release.slice(release.indexOf("\n  publish:"));

  it("is a dependencies job on every pull request, running the audit against main and the signatures", () => {
    expect(ci).toMatch(/on:\n {2}push:\n {4}branches: \[main\]\n {2}pull_request:\n/);
    expect(job).toContain("pnpm install --frozen-lockfile");
    expect(job).toContain("node scripts/dependency-check.mjs --base origin/main");
    expect(job).toContain("node scripts/dependency-check.mjs signatures");
    expect(job).toContain("fetch-depth: 0");
    expect(job).not.toMatch(/\n {4}if:/);
  });

  it("runs both in the release job, after the install and before anything is published", () => {
    const install = publish.indexOf("pnpm install --frozen-lockfile");
    expect(publish.indexOf("node scripts/dependency-check.mjs --base")).toBeGreaterThan(install);
    expect(publish.indexOf("node scripts/dependency-check.mjs --base")).toBeLessThan(publish.indexOf("release-publish.mjs"));
    expect(publish.indexOf("node scripts/dependency-check.mjs signatures")).toBeGreaterThan(install);
    expect(publish.indexOf("node scripts/dependency-check.mjs signatures")).toBeLessThan(publish.indexOf("release-publish.mjs"));
  });
});

describe("a week before the lockfile takes a version", () => {
  it("is held by the repository's .npmrc, in pnpm's minutes", () => {
    const npmrc = readFileSync(resolve(root, ".npmrc"), "utf8");
    expect(npmrc).toMatch(/^minimum-release-age=10080$/m);
    expect(npmrc).not.toMatch(/^minimum-release-age-exclude/m);
  });

  it("and AGENTS.md says how an urgent fix is taken sooner, one package in its own pull request", () => {
    const agents = readFileSync(resolve(root, "AGENTS.md"), "utf8");
    const section = agents.slice(agents.indexOf("## Dependencies"), agents.indexOf("## Releasing"));
    expect(section).toContain("minimum-release-age=10080");
    expect(section).toContain("minimum-release-age-exclude[]=<name>");
    expect(section).toMatch(/its own pull request/);
  });
});
