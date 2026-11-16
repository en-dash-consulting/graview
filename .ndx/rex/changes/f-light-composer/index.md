---
id: "43503094-c369-4682-9e8b-8d7733f7be95"
type: "change"
title: "A composer a page fetches shares the shell's core, carries no checker, and its errors are the store's own"
slug: "f-light-composer"
intent: "Graview Cloud lends `composeChange` (the plan host) to owner and editor pages. Fetching `@graview/core/compose` lazily from the shell moved about 75 KB of zod and the brand's rules into every visitor's first load, so Cloud bundles it apart, about 660 KB, and that bundle's schemas make errors the shell's store does not recognize during rehearsal. A composer entry that shares the shell's core and leaves the checker out lets a host fetch it small."
acceptanceCriteria:
  - "`@graview/core/composer` exports `composeAppChange`, composing a plan's edits as `@graview/core/compose` does and compiling with the compile a page already has (test)"
  - "Fetched from Cloud's shell handed a compiled app, the composer carries no checker, no reshape traits and no zod, and stays under its budget behind its door (test, measured with the hosted page's tooling)"
  - "Fetching it adds at most 10 KB to what every visitor loads first (test)"
  - "The errors a store reads are recognized from whichever copy of core made them, so a schema from another copy is refused with its own SchemaError (test)"
  - "AGENTS.md lists the entry, and docs/stability.md says what it keeps"
touches:
  - "cc6c7380-a8ee-4630-a3a3-4fb1e6f940c6"
priority: "medium"
tags:
  - "graview"
  - "core"
  - "hq:feature:f-light-composer"
source: "Graview HQ feature:f-light-composer"
---
