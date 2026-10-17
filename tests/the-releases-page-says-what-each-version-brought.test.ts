import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * THE RELEASES PAGE SAYS WHAT EACH VERSION BROUGHT, AND NO VERSION GOES UNSAID.
 *
 * graview.dev/docs/releases.html is written from the release records in
 * apps/site/releases.json: a headline and a few plain lines per version, by
 * hand, with the Version packages pull request. A record nobody wrote is a
 * version the page silently skips, so the changelog changesets writes is the
 * list it is held to. A pull request that only adds a changeset leaves the
 * changelog alone and so passes; the Version packages step adds a heading to
 * @graview/core's changelog, and this fails until that version has a record.
 */
const root = resolve(import.meta.dirname, "..");
type Release = { version: string; date?: string; headline: string; summary: string; compatibility?: string; published: boolean; shippedIn?: string };
const records = (JSON.parse(readFileSync(resolve(root, "apps/site/releases.json"), "utf8")) as { releases: Release[] }).releases;
const changelog = [...readFileSync(resolve(root, "packages/core/CHANGELOG.md"), "utf8").matchAll(/^## (\S+)\s*$/gm)].map(([, version]) => version!);
const page = readFileSync(resolve(root, "docs/site/docs/releases.html"), "utf8");
const main = page.slice(page.indexOf("<main"), page.indexOf("</main>"));
const anchorOf = (version: string) => `v${version.replace(/\./g, "-")}`;
const newer = (a: string, b: string) => {
  const [pa, pb] = [a.split(".").map(Number), b.split(".").map(Number)];
  for (let i = 0; i < 3; i += 1) if (pa[i] !== pb[i]) return pa[i]! > pb[i]!;
  return false;
};

describe("the release records", () => {
  it("has a record for every version in @graview/core's changelog, and for none it does not name", () => {
    const missing = changelog.filter((version) => !records.some((r) => r.version === version));
    expect(missing, "write each one's record in apps/site/releases.json, then pnpm site:build:all").toEqual([]);
    // A version not yet in the changelog has not shipped: 0.1.31 waits for its Version packages pull request.
    expect(records.map((r) => r.version).filter((version) => !changelog.includes(version))).toEqual([]);
    expect(new Set(records.map((r) => r.version)).size).toBe(records.length);
  });

  it("says when npm published each version, and which later version carried one it never had", () => {
    for (const record of records) {
      expect(record.headline.trim(), record.version).not.toBe("");
      expect(record.summary.trim(), record.version).not.toBe("");
      if (record.published) {
        expect(record.date, record.version).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      } else {
        const carrier = records.find((r) => r.version === record.shippedIn);
        expect(carrier?.published, `${record.version} names the published version that carried it`).toBe(true);
        expect(newer(carrier!.version, record.version), record.version).toBe(true);
      }
    }
    // AGENTS.md's Releasing section: 0.1.13 was versioned and never published, and ships inside 0.1.14.
    expect(records.find((r) => r.version === "0.1.13")).toMatchObject({ published: false, shippedIn: "0.1.14" });
  });
});

describe("the releases page", () => {
  const sections = [...main.matchAll(/<section id="(v[^"]+)"/g)].map(([, id]) => id!);
  const published = records.filter((r) => r.published).map((r) => r.version);

  it("gives every version npm has one section, newest first, and none to a version npm never had", () => {
    expect(sections).toEqual([...published].sort((a, b) => (newer(a, b) ? -1 : 1)).map(anchorOf));
    for (const record of records.filter((r) => !r.published)) expect(sections, record.version).not.toContain(anchorOf(record.version));
  });

  it("says a version npm never had inside the version that carried it", () => {
    const fourteen = /<section id="v0-1-14"[\s\S]*?<\/section>/.exec(main)?.[0] ?? "";
    expect(fourteen).toContain("Also in it: 0.1.13</strong>, which was versioned and never published");
  });

  it("links each version's release and its full changelog, rather than copying the changelog in", () => {
    for (const version of published) {
      const body = new RegExp(`<section id="${anchorOf(version)}"[\\s\\S]*?</section>`).exec(main)?.[0] ?? "";
      expect(body, version).toContain(`href="https://github.com/en-dash-consulting/graview/releases/tag/graview%40${version}"`);
      expect(body, version).toContain(`href="https://github.com/en-dash-consulting/graview/blob/main/packages/core/CHANGELOG.md#${version.replace(/\./g, "")}"`);
      expect(body, version).toContain('class="release-headline"');
    }
    // No changeset hashes, no FR numbers: a summary, not the changelog.
    expect(main).not.toMatch(/\b[0-9a-f]{7}:|\bFR-\d+/);
  });

  it("calls out what breaks or moves for a host before the upgrade", () => {
    for (const record of records.filter((r) => r.published && r.compatibility)) {
      const body = new RegExp(`<section id="${anchorOf(record.version)}"[\\s\\S]*?</section>`).exec(main)?.[0] ?? "";
      expect(body, record.version).toContain('<div class="release-compat"><p><strong>Before you upgrade:</strong>');
    }
  });
});
