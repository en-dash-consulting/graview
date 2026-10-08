---
id: "6fa83cff-711f-471d-8ef0-a1365c5324ee"
level: "feature"
title: "One app bar on every face: the app, its places, and three tools (FR-131)"
status: "completed"
priority: "critical"
tags:
  - "graview-cloud"
  - "FR-131"
  - "design"
  - "a11y"
source: "Graview Cloud, 2026-10-07 (handoff: one app bar, and the scene as a place — from Nick using Farm Bureau POM Workshop)"
startedAt: "2026-10-08T00:01:41.000Z"
completedAt: "2026-10-08T00:01:41.000Z"
endedAt: "2026-10-08T00:01:41.000Z"
acceptanceCriteria:
  - "A single bar holds: the app (its mark — brand logo else colour mark — then its name, said once as the page's one heading; pressing it goes home); places as plain tabs, the current marked, overflow in More ▾; tools at the right, one size (28-32 px), labelled: Find (inline; Cmd/Ctrl-K on desk), the Standing (a dot in good/warn/bad tone, a number only when a rule is broken, opening the problems; 'Everything is in order' in its accessible name and on hover), the person (an avatar menu holding seat and seats, hostActions, Report this app)"
  - "The Pages face's own header (title, Find, Problems tab) goes"
  - "On a desk and a phone, on both faces: one bar, one heading naming the app, no text repeated between the bar and the page; pnpm verify quiet: at most one bar row on a desk, two on a phone (the second the places)"
description: "Nick: 'the top title and scene/pages toggle and whatnot is really ugly, bloated and also broken when there's a notification… boilerplate chrome crap.' Two stacked bars say the name, the way into the scene and the state of the rules twice each."
lastModified: "2026-10-08T01:00:00.000Z"
resolution: "Shipped in #137 (0.1.16): one AppBar over every face (the app, its places with More, Find, the standing and the person); the routed face's own header and the embed's strip are gone. pnpm verify quiet holds one row on a desk and two on a phone."
---
