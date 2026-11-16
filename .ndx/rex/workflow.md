# Graview: the rules every build follows

These apply to every agent that changes this repository: one started by
`ndx work`, by the `dev-sync` pass, or from a brief by hand. The loop they sit
in is [`docs/process.md`](../../docs/process.md); the project itself is
[`AGENTS.md`](../../AGENTS.md). Steps marked (new in 0.2.5) apply once the
builds that introduce them are on main; until then, do them the 0.2.4 way
that `docs/process.md` describes.

1. **Work on a branch and open a pull request; never commit to main.**
   Main's ruleset refuses a direct push, and a PR is where CI and review see
   the change. This holds for PRD and walk commits too.
2. **Write a failing test first, where one can be written.** A test that
   failed before the change and passes after is the only proof the change did
   what it claims. Name it for the claim it holds.
3. **Before the first push, have an independent reviewer read the diff
   cold.** Hand it the diff and the brief, not your conclusions: a reviewer
   told what you think finds what you think. Fix what is real, review again,
   stop when it converges.
4. **Freeze a PR once its CI is green and you have reported.** Push again
   only if CI goes red or you are asked to. A push after "done" cancels the
   Nightly on that head and invalidates the review; on 0.2.4 that canceled
   four Nightly runs.
5. **Nightly runs only on a frozen head, and only for harness, render or
   focus changes.** It takes about half an hour of nine runners; on a head
   that will move, or a change no harness reads, it buys nothing.
6. **Run unit tests and `pnpm verify <name> --quick` locally; run full
   harnesses with `pnpm verify:github <names>` (new in 0.2.5).** Full runs on
   a power-limited laptop were most of a build's hours. Run one harness chain
   per machine at a time, on your slot's `GRAVIEW_PORT_BASE`: harnesses hold
   ports and CPU, and two chains on one machine fail each other.
7. **Write no budget raise files on a PR; the batch writes them (new in
   0.2.5).** On a PR the byte budget only warns. Raises written per PR
   conflicted with each other and summed wrong once merged.
8. **Write a `patch` changeset for every change under `packages/`, with a
   `Compatibility:` line where a surface is touched.** CI refuses a package
   change without one; a bump other than `patch` is a claim somebody must
   make on purpose; the `Compatibility:` line is what `docs/stability.md`
   promises a host (surfaces are listed in `scripts/lib/surfaces.mjs`).
9. **Never put a security fault's mechanism in public text.** The repository
   is public, and public text is every commit message, changeset, PR title
   and body, the PRD (`.ndx/` included), test names and code comments. Say
   "Security and reliability fixes" or the like. Give a security ask a
   neutral intent in the PRD. A private brief may say it in full. This has
   leaked once already.
10. **Report each harness's failing claims by name.** Read `docs/<name>.json`
    (or the run's verdict artifact) and name the claim that stopped holding;
    a summary of a log hides which promise broke.
11. **Keep machine identifiers out of the tree.** Run records and analysis
    output are committed; hostnames, usernames and home-directory paths are
    not. Scrub what a tool wrote before committing.
12. **Spell in American English.** A test holds the tree to it
    (`tests/the-repo-spells-in-american-english.test.ts`), and two spellings
    of one name are two names. Graview is source-available under the Elastic
    License 2.0; never call it "open source".
