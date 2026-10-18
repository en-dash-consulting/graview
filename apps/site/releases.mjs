/**
 * THE RELEASES PAGE: what came in each version, from the release records.
 *
 * The records are apps/site/releases.json, one per version in
 * @graview/core's changelog, written with the Version packages pull request:
 * a headline, a few plain lines for someone deciding whether to upgrade, and
 * what breaks or moves for a host. The page says each version npm has,
 * newest first, with its release and its full changelog a link away; a
 * version that was versioned and never published is said inside the version
 * that carried it to npm. The changelogs themselves stay where changesets
 * writes them, linked rather than copied.
 */
import { escape, inline, render, REPOSITORY, section } from "./prose.mjs";

const anchorOf = (version) => `v${version.replace(/[^0-9a-z]+/gi, "-")}`;
const tagOf = (version) => `graview@${version}`;
const releaseUrl = (version) => `${REPOSITORY}/releases/tag/${encodeURIComponent(tagOf(version))}`;
/** The version's section of @graview/core's changelog, as GitHub anchors a `## 0.1.30` heading. */
const changelogUrl = (version) => `${REPOSITORY}/blob/main/packages/core/CHANGELOG.md#${version.replace(/\./g, "")}`;
const newestFirst = (a, b) => {
  const pa = a.split(/[.-]/).map(Number);
  const pb = b.split(/[.-]/).map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i += 1) {
    const d = (pb[i] ?? 0) - (pa[i] ?? 0);
    if (d) return d;
  }
  return 0;
};
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const dated = (iso) => {
  const [y, m, d] = iso.split("-").map(Number);
  return `${MONTHS[m - 1]} ${d}, ${y}`;
};

/** The versions npm has, newest first, each with the versions it carried that npm never had. */
export function releasesOf(site) {
  const all = site.records("release").map((r) => r.fields);
  return all
    .filter((r) => r.published)
    .sort((a, b) => newestFirst(a.version, b.version))
    .map((release) => ({ ...release, carried: all.filter((r) => !r.published && r.shippedIn === release.version).sort((a, b) => newestFirst(a.version, b.version)) }));
}

function releaseSection(release) {
  const id = anchorOf(release.version);
  const carried = release.carried.map((earlier) =>
    `      <p class="release-carried sm"><strong>Also in it: ${escape(earlier.version)}</strong>, which was versioned and never published, so its changes shipped here. ${inline(earlier.headline)} ${inline(earlier.summary)}</p>\n`,
  ).join("");
  return section(id, release.version,
    `      <p class="release-when sm dim">${release.date ? `Published ${dated(release.date)}` : ""}${release.current ? " · the current version" : ""}</p>\n` +
    `      <p class="release-headline">${inline(release.headline)}</p>\n` +
    `      ${render(release.summary)}\n` +
    carried +
    (release.compatibility ? `      <div class="release-compat">${render(`**Before you upgrade:** ${release.compatibility}`)}</div>\n` : "") +
    `      <p class="release-links sm"><a class="inl" href="${releaseUrl(release.version)}">The release on GitHub</a> · <a class="inl" href="${changelogUrl(release.version)}">The full changelog for ${escape(release.version)}</a></p>`,
  );
}

const STYLE = `    <style>
    .release-versions { margin: 16px 0 0; padding: 0; list-style: none; display: flex; flex-wrap: wrap; gap: 4px 14px; }
    .release-versions a { display: inline-block; min-height: 24px; padding: 2px 0; }
    .release-when { margin: 0; }
    .release-headline { margin: 8px 0 0; font-size: 17px; line-height: 1.5; font-weight: 600; color: var(--ink); }
    .release-compat { margin: 14px 0 0; padding: 8px 12px 10px; border-left: 2px solid var(--amber); background: var(--amber-wash); border-radius: 0 var(--radius-sm) var(--radius-sm) 0; }
    .release-compat p { margin: 0; line-height: 1.65; color: var(--ink); overflow-wrap: anywhere; }
    .release-headline + p, .release-headline + ul { margin-top: 10px; }
    .release-carried { margin: 12px 0 0; }
    .release-links { margin: 14px 0 0; }
    </style>`;

export function releasesBody(site) {
  const releases = releasesOf(site);
  return (
    STYLE + "\n" +
    `    <section id="what" aria-labelledby="h-what" style="padding-top: 6px;">\n` +
    `      <h1 id="h-what">Releases</h1>\n` +
    `      <p class="lede" style="margin-top: 18px;">This is what came in each Graview version, newest first, in a few plain lines for deciding whether to upgrade. Every <code>@graview/*</code> package and <code>graview</code> share one version, so each version is said once.</p>\n` +
    `      <p class="sm dim">Each version links its release and its full changelog. <strong>Before you upgrade</strong> says what breaks or moves for a host; <a class="inl" href="stability.html">Stability</a> says what a version may change at all.</p>\n` +
    `      <ul class="release-versions" aria-label="Versions">${releases.map((r) => `<li><a class="inl" href="#${anchorOf(r.version)}"><code>${escape(r.version)}</code></a></li>`).join("")}</ul>\n` +
    `    </section>\n` +
    releases.map(releaseSection).join("")
  );
}
