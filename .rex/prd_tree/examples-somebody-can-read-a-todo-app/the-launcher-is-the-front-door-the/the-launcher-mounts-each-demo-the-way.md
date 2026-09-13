---
id: "5adef2d6-e70e-456e-918d-ee8a6d96debe"
level: "task"
title: "The launcher mounts each demo the way the demo opens itself: the remembered store, its seat, its brand"
status: "pending"
priority: "high"
tags:
  - "launcher"
  - "persistence"
  - "todo"
  - "seedbed"
source: "Nick, 2026-09-13: \"oh actually maybe Things already is. maybe its just when it's opened thru the launcher\""
acceptanceCriteria:
  - "each demo exports open() — the store its main opens, with adapter, seed, seat and brand — and its main and the launcher both use it"
  - "an edit made in Things through the launcher is there after a reload of the launcher, and after opening Things at its own port, from the same browser"
  - "Things and Seedbed opened through the launcher keep separate remembered stores"
  - "verify-remember drives the launcher as well as Things"
description: "Opened at its own port, Things opens its store through ship's openStore with the browser adapter and remembers every edit; opened through the launcher, the same TodoApp is mounted with no store, builds an in-memory one from the example, and forgets on reload — so the launcher hides the one persistence capability the demos already have, and Nick could not tell whether Things persisted at all. Each demo should export the way it opens itself (an `open()` returning its store, seat and brand, the same code its main.tsx runs) and the launcher should mount through that, with the browser adapter scoped per app so Things and Seedbed do not share a store. The launcher's capability list then reads \"remembers in the browser\" from the mount, not by assertion. Source: Nick, 2026-09-13: \"oh actually maybe Things already is. maybe its just when it's opened thru the launcher\"."
lastModified: "2026-09-13T05:00:36.439Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
