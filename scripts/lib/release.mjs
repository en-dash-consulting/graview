/**
 * WHAT A PUSH TO MAIN RELEASES, DECIDED WHERE A TEST CAN HOLD IT.
 *
 * The release workflow asks `scripts/release-state.mjs`, which gathers the
 * facts (the changesets on disk, what npm has, the Nightly runs) and hands
 * them to `decide` here. The rules, in the order they are asked:
 *
 *   - The packages do not share one version: nothing is released, and the
 *     run fails, because `graview create` writes `^<version>` for all of them.
 *   - A changeset is pending (a pull request merged outside a batch, which
 *     carries none of its own release): the Version packages pull request
 *     is opened or updated, as before. Nothing is published, so nothing a
 *     changeset says is ever stranded behind a release that skipped it.
 *   - Nothing pending and every package at the version on npm: nothing to do.
 *   - Nothing pending and a package at the version not on npm: publish,
 *     but only when a green Nightly ran on this very tree. A batch's Nightly
 *     ran on its head; a merge of it that conflicts with nothing has the same
 *     tree, so it counts. Without one the run fails and says to dispatch
 *     Nightly on main. The publish itself still waits for the `npm`
 *     environment's one approval.
 */

/** @typedef {{ id: number | string, url: string, event: string, conclusion: string | null, repository: string, headSha: string, tree: string }} NightlyRun */

/** The events a Nightly that counts was started by: its schedule, or a person dispatching it in this repository. */
export const NIGHTLY_EVENTS = new Set(["schedule", "workflow_dispatch"]);

/**
 * The newest green Nightly that ran on `tree` in `repository`, or null.
 * The tree is the gate, not the commit: a merge of a green batch that
 * conflicts with nothing has a new commit and the batch head's tree. The
 * tree holds `nightly.yml` itself, so a run of a changed Nightly never
 * stands for main's. Only a run this repository's own people started
 * counts; nothing a pull request starts does.
 *
 * @param {string} tree
 * @param {NightlyRun[]} runs newest first, as the API lists them
 * @param {string} repository owner/name
 */
export function nightlyOnTree(tree, runs, repository) {
  if (!tree) return null;
  return (
    runs.find(
      (run) =>
        run.conclusion === "success" &&
        NIGHTLY_EVENTS.has(run.event) &&
        run.repository === repository &&
        run.tree === tree,
    ) ?? null
  );
}

/**
 * @param {{ versions: string[], pending: string[], unpublished: string[], nightly: NightlyRun | null }} facts
 *   versions: every published package's version; pending: the changeset files;
 *   unpublished: the packages npm does not have at the version; nightly: the
 *   green Nightly on this tree, if one ran.
 * @returns {{ path: "broken" | "version-pr" | "nothing" | "publish" | "blocked", version: string | null, reason: string }}
 */
export function decide({ versions, pending, unpublished, nightly }) {
  const distinct = [...new Set(versions)];
  if (distinct.length !== 1) {
    return {
      path: "broken",
      version: null,
      reason: `The packages do not share one version (${distinct.join(", ") || "none found"}); \`changeset version\` makes them agree, since they are one fixed group.`,
    };
  }
  const [version] = distinct;
  if (pending.length > 0) {
    return {
      path: "version-pr",
      version,
      reason: `${pending.length} changeset(s) on main that no release carried: the Version packages pull request takes them.`,
    };
  }
  if (unpublished.length === 0) {
    return { path: "nothing", version, reason: `Every package at ${version} is on npm, and no changeset is pending.` };
  }
  if (!nightly) {
    return {
      path: "blocked",
      version,
      reason:
        `${unpublished.join(", ")} at ${version} not on npm, and no green Nightly ran on this tree. ` +
        "Dispatch Nightly on main (Actions → Nightly → Run workflow, branch main, or `gh workflow run nightly.yml --ref main`), " +
        "then re-run this workflow once it is green.",
    };
  }
  return {
    path: "publish",
    version,
    reason: `${unpublished.join(", ")} at ${version} not on npm; the Nightly ${nightly.url} ran green on this tree (${nightly.headSha.slice(0, 8)}).`,
  };
}

/* ─── The release record a batch carries ─── */

/** What a scaffolded record says until a person writes it; the releases test refuses a record that still says it. */
export const UNWRITTEN = "WRITE ME";

/** A changeset file's body, without its front matter. */
export function changesetBody(text) {
  const match = /^---\n[\s\S]*?\n---\n?/.exec(text);
  return (match ? text.slice(match[0].length) : text).trim();
}

/** The first sentence of a changeset: what it does, said once. */
export function firstSentence(body) {
  const prose = body.split(/\n\s*\n/)[0]?.replace(/\s+/g, " ").trim() ?? "";
  const end = /(?<![A-Z][a-z]?|e\.g|i\.e|vs)[.!?](?=\s|$)/.exec(prose);
  return end ? prose.slice(0, end.index + 1) : prose;
}

/** A changeset's `Compatibility:` line, without the label, or null. */
export function compatibilityOf(body) {
  const line = body.split("\n").find((one) => /^Compatibility:/.test(one.trim()));
  return line ? line.trim().replace(/^Compatibility:\s*/, "") : null;
}

/**
 * A release record for `version`, scaffolded from the changesets it spends,
 * for a person to rewrite: the headline and the compatibility line say
 * `UNWRITTEN` until they do. The compatibility line leads with what breaks
 * for a host — the changesets that say "break" first — since that is what
 * the Releases page puts before the upgrade.
 *
 * @param {string} version
 * @param {{ name: string, text: string }[]} changesets
 * @param {string} date YYYY-MM-DD, the day it is expected on npm (UTC)
 */
export function scaffoldRecord(version, changesets, date) {
  const bodies = changesets.map(({ name, text }) => ({ name, body: changesetBody(text) }));
  const said = bodies.map(({ body }) => compatibilityOf(body)).filter(Boolean);
  const breaks = (line) => /\bbreak(s|ing)?\b(?!:?\s+nothing)/i.test(line);
  const breaking = said.filter(breaks);
  const rest = said.filter((line) => !breaks(line));
  return {
    version,
    date,
    headline: `${UNWRITTEN}: one sentence a host reads first — what ${version} brings.`,
    summary: bodies.map(({ body }) => `- ${firstSentence(body)}`).join("\n"),
    compatibility: [
      `${UNWRITTEN}: lead with what breaks for a host ("Breaks: nothing." when nothing does), then what it gains.`,
      ...breaking,
      ...rest,
    ].join(" "),
    published: true,
  };
}

/** The records with this version's put first, unless one is already there. */
export function withRecord(records, record) {
  if (records.some((one) => one.version === record.version)) return { records, added: false };
  return { records: [record, ...records], added: true };
}
