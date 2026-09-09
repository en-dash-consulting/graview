# @graview/pages

## 0.0.1

### Patch Changes

- 4bd846b: The horizon, modules, selection-as-a-stop, the traditional face (@graview/pages), the intelligence seam, and the ship subpackage (persistence wiring, op-log-native migrations, export bundles, health).
- cfdad5a: The sample apps remember. `@graview/ship` gains a browser adapter — the
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
- 329da2e: The pages face reads like a product's own site, not a back office. The
  default shell, home, list, record and problems pages open with the thing
  itself — the installation's name and mark on a masthead, a front page that
  summarises what is here in the app's own declared words, lists whose
  members carry a line of their own facts, records titled in the display
  face with the kind's own description as the lede, relations captioned by
  the edge's declared words (an inbound edge by its `inverse`), and actions,
  forms and history receding beneath the content. Typography rides the
  brand's display and body faces at a real scale in both schemes; a kind's
  accent marks it on every page. `hueFor` — the hue thread every surface
  reads — now lives in `@graview/core` beside the brand that overrides it,
  re-exported by `@graview/render` unchanged. Every testid, route and
  parity derivation is as before.
- Updated dependencies [ec91236]
- Updated dependencies [37bb6af]
- Updated dependencies [e38fe86]
- Updated dependencies [964d140]
- Updated dependencies [5cd68d6]
- Updated dependencies [95cceb3]
- Updated dependencies [094f3cc]
- Updated dependencies [090ab39]
- Updated dependencies [23ab0fe]
- Updated dependencies [a94d8f5]
- Updated dependencies [87948ef]
- Updated dependencies [0f9b0fd]
- Updated dependencies [4bd846b]
- Updated dependencies [cfdad5a]
- Updated dependencies [34c1600]
- Updated dependencies [b156490]
- Updated dependencies [329da2e]
- Updated dependencies [77d1d4a]
- Updated dependencies [04eaefe]
- Updated dependencies [f24ef6e]
  - @graview/core@0.0.1
  - @graview/tools@0.0.1
  - @graview/layout@0.0.1
