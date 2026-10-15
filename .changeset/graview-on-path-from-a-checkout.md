---
"@graview/core": patch
"graview": patch
---

The graview command line is one line from PATH in a framework checkout. On a machine with the checkout and no published install there was no `graview` command, and every use was `node <checkout>/packages/graview/dist/cli.js`. The checkout's `pnpm graview:link` is `pnpm link --global` for `packages/graview` (after `pnpm setup` once, where pnpm has no global bin folder), written in the README's commands and AGENTS.md's; and `graview doctor`, run from a checkout with no `graview` on PATH, says so with that line and the full path to use until then — even in a folder with no package.json, which is where a document-only app lives.

Compatibility: no surface changes. `graview doctor` may print one more note; its exit code is unchanged.
