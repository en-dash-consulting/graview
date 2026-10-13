---
id: "07a4132b-6c2c-4d30-a409-12a433596a49"
level: "task"
title: "Walkthrough X · The tenth walk, from a fresh checkout, adds nothing"
status: "pending"
priority: "critical"
tags:
  - "roadmap"
  - "walkthrough"
blockedBy:
  - "ea07de68-4da5-4efd-bd90-a091528fb365"
source: "The ninth walk, 2026-10-13: thirteen findings and one carried open, no new class, so the log did not stay still."
acceptanceCriteria:
  - "a fresh checkout, pnpm install && pnpm build && pnpm test, then graview create of a new app beside it"
  - "all nine stages walked by an agent that did not do the first nine walks"
  - "docs/walkthrough-findings.md gains nothing; if it does, the fixes land with criteria and the walk repeats"
description: "The ninth walk (task ea07de68, a beekeeping co-op, ../walk9) added thirteen findings, W-190 to W-203 (no W-202), no new class; twelve fixed with criteria and one carried open. This is the next run: a fresh checkout, pnpm install && pnpm build && pnpm test, a new app beside it with graview create (use ../walk10, in a domain of its own, seeded at real size), all nine stages of docs/walkthrough.md by an agent that did not do the previous walks, and every finding fixed in a package with a criterion verified to fail without it. Start by asking whether the journeys walked anything, and whether the committed verdicts (docs/journeys.json, docs/gauntlet.json) were written after the last change to what they measure: the ninth walk found the gauntlet's verdict on main written before the map came to read upstream to downstream, and the change it missed blocking a job. Carried open: W-203, on a phone the map's districts (the gauntlet's Sessions, Rooms, Topics and Staff, the rota's Shifts, Locations and Volunteers) cannot be pressed — one district's box lies over a neighbor's control, and a nameplate that gives way leaves its control behind; verify-gauntlet's everyDistrictIsListedBesideTheMap fails on main. Still open from the eighth: narrowing on the scene where a kind's stop is a lens (todo, discography, seedbed, any app whose kind has a titled lens); seedbed's plots too few to narrow; \"Name a caretaker\" not on seedbed's pages; the rota's viewer not told \"Add a shift\" is not theirs on the scene; todo's \"Add a task\" after \"Today\"; the gauntlet's longest title out of the keyboard's reach in Find; the keyboard's cost (narrowing by a number on the scene, 50 presses against the pointer's 4); a repair from the in-app seat needs a model. And Nick's to decide (W-201): a role's own grant to make a kind still carries its derived remove, archive and merge over every record of it — a member who may log an inspection may remove anybody's — with no way in the policy to say theirs only. Seeding through acts at real size is quick since W-197; the hosted page has about 350 bytes gzipped of room. Run the browser harnesses one at a time, on a port block no other checkout holds (lsof first); stop any dev server first; a walker that adds or widens a watch rule runs the harnesses it touches without --quick."
lastModified: "2026-10-13T12:30:00.000Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
