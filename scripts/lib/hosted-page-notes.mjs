/**
 * THE HOSTED PAGE'S WEIGHT, AS RELEASE NOTES SAY IT (FR-104).
 *
 * Graview Cloud budgets its app shell, and most of the shell is the
 * framework's page: `openRemote` plus the embed over a compiled document
 * (lib/hosted-page.mjs builds it as Cloud does). A release that moves that
 * weight should say so where Cloud reads about the release, so this renders
 * the measurement as Markdown — up front by package, against the budget and
 * with the headroom left, and what each face fetches as it is first drawn.
 * `pnpm hosted` writes it to docs/hosted-page.md; the release step
 * (release-publish.mjs) measures again and puts it under the `graview` and
 * `@graview/embed` releases' notes.
 */
import { measureHostedPage } from "./hosted-page.mjs";

const kb = (bytes) => (bytes / 1024).toFixed(1);

/** The measurement as a Markdown section: a heading, a sentence, the table by package, and the faces. */
export function hostedPageMarkdown(measured, { heading = "###" } = {}) {
  const { upFront, beforeDrawn, budget } = measured;
  const headroom = budget.minified - upFront.minified;
  const rows = Object.entries(upFront.packages).map(([name, bytes]) => `| ${name} | ${kb(bytes)} |`);
  return [
    `${heading} The hosted page's weight`,
    "",
    `What Graview Cloud's app shell loads from the framework before the app draws — \`openRemote\` plus the embed over a compiled document, built as Cloud builds it (esbuild, split, minified) — is **${kb(upFront.minified)} KB** up front, against a budget of ${kb(budget.minified)} KB: **${kb(headroom)} KB of headroom**, and ${kb(600 * 1024 - upFront.minified)} KB under the 600 KB Graview Cloud's brief set. ${kb(upFront.zod)} KB of it is zod (at most ${kb(budget.zod)}).`,
    "",
    "| Package | Up front (KB, minified) |",
    "| --- | ---: |",
    ...rows,
    `| **Total** | **${kb(upFront.minified)}** |`,
    "",
    `Before a face draws, with what it fetches as it is first drawn: the scene ${kb(beforeDrawn.scene.minified)} KB (${kb(beforeDrawn.scene.fetched)} KB fetched), the pages ${kb(beforeDrawn.pages.minified)} KB (${kb(beforeDrawn.pages.fetched)} KB fetched).`,
    "",
  ].join("\n");
}

/** Measure the page from the repository's sources and render it; undefined when it cannot be measured (the notes go out without it). */
export async function hostedPageNotes(repo, options) {
  try {
    return hostedPageMarkdown(await measureHostedPage(repo), options);
  } catch (error) {
    process.stderr.write(`the hosted page could not be measured for the notes: ${error instanceof Error ? error.message : String(error)}\n`);
    return undefined;
  }
}
