---
id: "6fa83cff-711f-471d-8ef0-a1365c5324ee"
type: "capability"
title: "One app bar on every face: the app, its places, and three tools (FR-131)"
slug: "one-app-bar-on-every-face-the-app-its"
statement: "Every face of a Graview app shows one app bar that carries the app, its places and three tools."
criteria: [{"id":"c1","text":"The app bar shall show the app's mark (its brand logo, else a colour mark) followed by its name, said once as the page's one heading, and pressing it shall go home."},{"id":"c2","text":"The app bar shall show the app's places as plain tabs with the current place marked and any overflow held in a More ▾ menu."},{"id":"c3","text":"When the places do not fit beside the app's name and the tools, the app bar shall fold them into More ▾ on the same row, measured from the bar's real width rather than a count."},{"id":"c4","text":"The app bar shall centre its tabs in the bar's height so that no tab touches the top edge."},{"id":"c5","text":"The app bar shall show, at its right, three labelled tools of one size (28-32 px): Find, the Standing and the person."},{"id":"c6","text":"The Find tool shall be inline in the bar, and on a desk Cmd/Ctrl-K shall open it."},{"id":"c7","text":"The Standing tool shall show a dot in good, warn or bad tone and a number only when a rule is broken, and opening it shall open the problems."},{"id":"c8","text":"When no rule is broken, the Standing tool shall carry 'Everything is in order' in its accessible name and on hover."},{"id":"c9","text":"The person tool shall open an avatar menu holding the seat and seats, the host's actions and Report this app."},{"id":"c10","text":"The Pages face shall have no header of its own (title, Find, Problems tab) apart from the app bar."},{"id":"c11","text":"On a desk and on a phone, on both faces, the app shall show one bar and one heading naming the app, with no text repeated between the bar and the page."},{"id":"c12","text":"The app bar shall take at most one row on a desk and two rows on a phone, the second holding the places."},{"id":"c13","text":"At 1024, 1280 and 1440 px with six or more places, the app bar shall stay on one row with More ▾ holding the rest."}]
tags:
  - "graview-cloud"
  - "FR-131"
  - "design"
  - "a11y"
source: "Graview Cloud, 2026-10-07 (handoff: one app bar, and the scene as a place — from Nick using Farm Bureau POM Workshop)"
priority: "critical"
resolution: "Shipped in #137 (0.1.16): one AppBar over every face (the app, its places with More, Find, the standing and the person); the routed face's own header and the embed's strip are gone. pnpm verify quiet holds one row on a desk and two on a phone."
---

Nick: 'the top title and scene/pages toggle and whatnot is really ugly, bloated and also broken when there's a notification… boilerplate chrome crap.' Two stacked bars say the name, the way into the scene and the state of the rules twice each.
