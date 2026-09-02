---
"@graview/core": patch
"@graview/ship": patch
"@graview/primitives": patch
"@graview/pages": patch
---

The sample apps remember. `@graview/ship` gains a browser adapter — the
same snapshot, log and version the file adapter writes, in `localStorage`,
slotted into `openStore` unchanged with migrations included — behind a
`@graview/ship/browser` entry that carries no `node:fs`. `openStore` now
reopens a store WITH its persisted history (a `Store` accepts a snapshot
and the log that led to it), applies the declaration's own policy, mints
ids that cannot collide across sessions, and takes `fresh` to return to
the seed. The conventions a page reads — `?fresh=1`, a driven browser
starting fresh unless `?remember=1` — ship as `browserStartsFresh`,
`forgetFreshParam` and `freshHref`. Primitives gain `StartFresh` and the
activity popover says "Remembered in this browser" with the way back; the
pages face takes `remembers` and says the same in its footer.
