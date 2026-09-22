---
id: "cb5d4458-93c1-412e-8779-5e94ddbd3baa"
level: "task"
title: "Two product repos drifted off the framework without anything saying so"
status: "pending"
priority: "high"
tags:
  - "products"
  - "quality"
  - "drift"
source: "Found on 2026-09-22 while completing a2bd5497 and wiring the product repos' pages faces."
acceptanceCriteria:
  - "homeflow-graview's five failing tests pass, or the claim each makes is corrected and the test says the new thing"
  - "One command reports typecheck and test status for every linked product repo — squad, homeflow, proposal, groundskeeper — with one verdict"
  - "A framework change that breaks a product repo is visible without opening that repo"
  - "The `who` requirement and any future required prop are caught by that command rather than by somebody happening to typecheck"
description: "Found on 2026-09-22 while wiring the product repos' pages faces. `homeflow-graview` and `proposal-graview` had NOT TYPECHECKED since `AgentSeat` gained a required `who` — the prop arrived when robots became things other people can see (a robot registers as `agent:<who>:<session>` and is captioned \"X's agent\" on everybody else's screen), and neither app was updated. Both fixed in passing. `homeflow-graview` also has five failing tests on its own main, unrelated to that: `produces byte-identical diffs, differing only in attribution` expects `'agent'`/`'human'` and gets `undefined`, and three assertions want the relation named `'who does the run'` on screen and find `'the runs they drive'` instead — an edge's description was reworded in the app or the framework and its acceptance test was not. Confirmed pre-existing by running them against the previous commit. THE REAL PROBLEM IS NOT ANY OF THOSE THREE THINGS. It is that a framework change can require an edit in four product repos and nothing reports which of them still build: each repo is a separate checkout with its own `pnpm test`, linked to the framework by path, and nobody runs them all. The framework's own `pnpm verify` now gives one verdict for its harnesses; there is no equivalent across the products that depend on it."
lastModified: "2026-09-22T13:59:15.813Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
