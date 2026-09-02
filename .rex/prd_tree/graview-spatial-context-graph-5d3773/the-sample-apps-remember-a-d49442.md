---
id: "d4944239-f4bb-44c8-ac5f-0ffa52b159a1"
level: "feature"
title: "The sample apps remember: a browser adapter for ship's openStore"
status: "pending"
priority: "high"
acceptanceCriteria:
  - "A browser persistence adapter (localStorage, or IndexedDB if the log needs it) ships in the framework, storing the same snapshot/log/meta shape as ship's file adapter"
  - "It slots into ship's openStore unchanged: load, migrate, fold, persist every diff — migrations included"
  - "The sample apps opt in: an edit survives a reload, still attributed and undoable; the seed is the first load, not every load"
  - "A visible 'start fresh' affordance returns to the example, and ?fresh=1 forces the seed"
  - "Harnesses stay deterministic (fresh contexts start from the seed) and the full harness battery stays green"
  - "graview check and the smoke-install rehearsal cover the adapter like the file adapter"
description: "Every sample app boots from a JSON seed into memory and forgets everything on reload — reasonable for harnesses, dishonest for a demo that invites you to edit. The framework already owns the answer: persistence is the op log, and @graview/ship's openStore lifecycle (load, migrate, fold, persist every diff) takes an adapter — memory, sqlite and the file adapter exist, all node-side. What is missing is a BROWSER adapter: localStorage (or IndexedDB if the log outgrows it) storing the same snapshot/log/meta shape the file adapter writes, slotted into the same openStore, migrations included. The apps then opt in: edits survive reload, attributed and undoable as ever, with the seed as the FIRST load rather than every load. Two honesty constraints: a visible way back to the example ('start fresh' — a demo that can wedge itself in a broken state with no exit teaches distrust), and determinism for the harnesses (a fresh Playwright context starts clean; ?fresh=1 forces the seed for anyone else)."
lastModified: "2026-09-02T04:09:39.082Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
