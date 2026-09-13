# @graview/ship

## 0.0.2

### Patch Changes

- ea93a35: "Remove this field" survives being written down. A patch said it by carrying the key with the value `undefined`, which JSON drops — so every persisted op that cleared a field came back with an empty half and the inverse it promised did nothing at all. Undoing a migration that added a field, after a reload, reported success and changed nothing. `UNSET` is that instruction as a value now, normalised into every operation on its way into the log, and both appliers read it.
- Updated dependencies [a5a867e]
- Updated dependencies [a10c8d0]
- Updated dependencies [60db3d0]
- Updated dependencies [6ecf8ec]
- Updated dependencies [3251440]
- Updated dependencies [1f232bb]
- Updated dependencies [4b96ddb]
- Updated dependencies [08befa1]
- Updated dependencies [99b4b27]
- Updated dependencies [ea93a35]
- Updated dependencies [ced759d]
- Updated dependencies [a5a867e]
- Updated dependencies [5410e86]
- Updated dependencies [5ef7e9b]
- Updated dependencies [992ac22]
  - @graview/core@0.0.2

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
- Updated dependencies [ec91236]
- Updated dependencies [e38fe86]
- Updated dependencies [5cd68d6]
- Updated dependencies [95cceb3]
- Updated dependencies [094f3cc]
- Updated dependencies [090ab39]
- Updated dependencies [a94d8f5]
- Updated dependencies [87948ef]
- Updated dependencies [4bd846b]
- Updated dependencies [cfdad5a]
- Updated dependencies [34c1600]
- Updated dependencies [329da2e]
- Updated dependencies [77d1d4a]
- Updated dependencies [04eaefe]
- Updated dependencies [f24ef6e]
  - @graview/core@0.0.1
