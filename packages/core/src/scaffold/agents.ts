import type { Ids } from "./names.js";

/*
 * WHAT AN AGENT READS WHEN IT OPENS THE REPOSITORY COLD.
 *
 * A product had fifteen skills installed and a generated `docs/agents.md`,
 * and nothing at its root: an agent found README.md and had to discover the
 * loop and the skills by itself. `graview create` writes `AGENTS.md` at the
 * root and a `CLAUDE.md` that imports it; `graview docs` writes
 * `docs/agents.md`. The three rules are said by ONE function here, which
 * both call, so the two files cannot disagree about the contract.
 */

/**
 * The three rules, in order. `only` is how the second names the acts: the
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
