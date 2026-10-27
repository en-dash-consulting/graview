import type { Ids } from "./names.js";

/*
 * WHAT AN AGENT READS WHEN IT OPENS THE REPOSITORY COLD.
 *
 * A product had fifteen skills installed and a generated `docs/agents.md`,
 * and nothing at its root: an agent found README.md and had to discover the
 * loop and the skills by itself. `graview create` writes `AGENTS.md` at the
 * root and a `CLAUDE.md` that imports it; `graview docs` writes
 * `docs/agents.md`. The four rules are said by ONE function here, which
 * both call, so the two files cannot disagree about the contract.
 *
 * The fourth came from a face that read its content from the side (FR-232):
 * an agent asked for a pitch section wrote a JSON file a page imported, and
 * asked to tag a chart wrote the tags beside the graph too; each looked
 * right on its page and the scene, Find, the record pages and Ask never saw
 * it, because nothing was a record. `graview check` names a face module
 * that reads one (`face-reads-content-beside-the-graph`).
 */

/**
 * The four rules, in order. `only` is how the second names the acts: the
 * generated file lists the app's mutations, the root file points at it.
 */
export function agentRules(only: string): readonly string[] {
  return [
    "1. **The graph is the interface.** Do not write to storage. Every change",
    "   goes through a typed mutation so it carries attribution, an inverse,",
    "   and the set of nodes it read.",
    `2. **Only these mutations exist:** ${only}.`,
    "   A change you cannot express as one of them is a change the app has",
    "   not agreed to; add a mutation rather than reaching around it.",
    "3. **Preview before you apply.** Every mutation previews as a diff plus",
    "   the invariants it would break. A preview that introduces a violation",
    "   is a proposal, not a fix.",
    "4. **What the face shows is in the graph.** A pitch's sections, a chart's",
    "   tags, a page's copy: declare a kind or a field for it and seed it,",
    "   never a JSON file a view imports. The scene, Find, the record pages",
    "   and Ask see records and nothing beside them; `graview check` names a",
    "   face module that reads one (`face-reads-content-beside-the-graph`).",
  ];
}

/**
 * How a declaration change is made in a repository git keeps, said by the
 * same two files (FR-232). Graview Cloud's `propose_change` applies a
 * change that loses nothing without asking and asks first only when the
 * preview says records would be lost; a project under git has the same way
 * back, so an agent there asks no more often.
 */
export function agentDefaults(): readonly string[] {
  return [
    "A declaration change that loses nothing — a kind, a field, an option, a",
    "rule or an act added; a title or a description changed — is made",
    "without asking: declare it, run the check, commit it with the docs it",
    "regenerates. Git keeps the way back. Ask first only when the change would",
    "lose what people put in — a kind or a field removed, an option taken",
    "away, a type narrowed — and say what would be lost.",
  ];
}

/**
 * Where `graview skills install` lists the skills it installed, in AGENTS.md
 * (`@graview/skills` holds the same two markers, and its test says so).
 */
export const SKILLS_BEGIN = "<!-- graview skills: `graview skills install .` rewrites this list -->";
export const SKILLS_END = "<!-- /graview skills -->";

/** The root instruction file: the loop, the rules, the skills. */
export function agentsMd(ids: Ids, workspace: boolean): string {
  const run = ids.packageManager === "pnpm" ? "pnpm" : "npm run";
  const docs = workspace ? "app/docs" : "docs";
  const domain = workspace ? "app/src/domain" : "src/domain";
  return `# ${ids.name} — notes for agents

${ids.name} is a product on Graview: a typed context graph that **is** the
interface. Everything a person or an agent can see and do is derived from the
declaration in \`${domain}/\` — its kinds, its acts, its rules. Change the
declaration, not the screens.

## The loop

\`\`\`sh
${run} check      # graview check: what is wrong with the declaration, and the fix
${run} verify     # typecheck, tests, build, check, and ${docs}/agents.md regenerated
\`\`\`

Declare something in \`${domain}/\`, run \`${run} check\` until it reports no
errors, then \`${run} verify\` before you say it works — and report what they
actually said. \`${run} dev\` serves the app on http://localhost:${ids.port}.

${agentDefaults().join("\n")}

## Or as a document

The same declaration can be one JSON file: \`app.json\`, a graview-document
(\`"format": "graview-document"\`), whose schema is
\`node_modules/@graview/core/dist/document.schema.json\` — point its
\`"$schema"\` there. It is compiled, never run, and needs no build:

\`\`\`sh
npx graview check --document app.json      # each finding at its JSON path, e.g. rules.<rule>.repairs.0
npx graview describe --document app.json   # what a blank installation meets
npx graview preview app.json --seed seed.json   # the scene and Pages over a snapshot: open the Pages address it prints (it carries the run's key)
\`\`\`

## The rules

${agentRules(`the ones \`${docs}/agents.md\` lists, generated from the declaration by \`${run} verify\``).join("\n")}

\`${docs}/agents.md\` is the contract for this app as declared now, and
\`${docs}/llms.txt\` the full reference: every kind, edge, act and rule.

## The skills

Each one is a move with a verdict at the end, installed into \`.claude/skills\`
and \`.agents/skills\`:

${SKILLS_BEGIN}
Not installed yet: \`${run} skills\` installs them and lists them here.
${SKILLS_END}
`;
}

/** Claude Code reads CLAUDE.md; the notes are AGENTS.md, for every assistant. */
export function claudeMd(): string {
  return "@AGENTS.md\n";
}
