---
id: "50df277d-9905-40ac-a35f-f458e47cedba"
level: "epic"
title: "The city: the graph is a place, and people and their agents are in it"
status: "completed"
priority: "high"
tags:
  - "spatial"
  - "city"
  - "agent"
  - "presence"
  - "multiplayer"
  - "lens"
source: "Nick, 2026-09-19: \"make the graview view more like a city view. it's almost like each Kind is its own little village or neighborhood, and when a kind has a Lens, it's like a drive-in theater at that neighborhood ... the AI can be like a little robot that can wheel around to wherever you are ... you can see from the graview what drive-ins the other people are at. it's kind of like Gather ... but it's the context graph that you are watching people view and interact with.\""
startedAt: "2026-09-19T08:21:59.783Z"
completedAt: "2026-09-19T08:21:59.783Z"
endedAt: "2026-09-19T08:21:59.783Z"
description: "Today the altitude picture is an ellipse of nameplates (ring() in packages/layout/src/layout.ts, positions by sorted kind id), the focused lens floats in the middle bound to nothing, the agent seat is a button inside a chrome popover, and there is no notion of anyone else. The picture orients, but it is not somewhere: nothing in it has an address, so the AI has nowhere to be and other people have nowhere to stand.\n\nThe move is to make the altitude picture a CITY with real geometry: each kind a NEIGHBORHOOD with a plot on the lattice whose position comes from the declaration (adjacent when related, roads where the schema draws edges) and is the same on every screen and in every session; each lens a DRIVE-IN whose screen stands at its kind's plot, so descending into a view is walking up to the screen rather than a card appearing; the agent seat a ROBOT that occupies the scene, stands where it reads and writes, comes to the cursor when asked, and says its refusals at the gate it cannot pass; and other people FIGURES at the drive-in they are watching, with their own robots, over an ephemeral presence channel that is deliberately not the op log.\n\nFour properties hold throughout. (1) Honest geometry: every position is derived from the declaration, the graph, or a real event; nothing wanders, nothing is decorative, and a quiet city runs no animation loop. (2) Affine only: boxes stay axis-aligned and every transform stays scale+translate; the iso is drawn inside boxes, as it is now. (3) Every stop is a URL: the city adds no camera state beyond what ViewState already carries, and \"where somebody is\" is toUrl(view) plus a pick id, never pixels. (4) One seam for acting: the robot is the existing seat (createToolRuntime with an agent author acting for the seated principal); it gains a body, not new powers.\n\nFour tasks, in order, each blocking the next: the map (an address for everything, whereIs()), the drive-ins (lenses anchored at plots), the robot (a scene occupant driven by the seat's own reads, writes, and refusals, plus follow mode), and presence (figures for other people and their robots over BroadcastChannel and the ship server). The map is the foundation because the robot and the figures are both drawn by asking where a kind or node is; the drive-ins come second because \"at a drive-in\" is what presence reports.\n\nRelated, already built and to be reused rather than replaced: the activity fold and Attention pseudo-op (packages/react/src/activity.ts) which is exactly \"an agent looked at this\"; participantOf(op) which is already the presence key; toUrl/sameView; the natural/shrink mechanism that draws a live lens small; measureVisible and data-graview-pick which is how any drawn thing becomes a target for ties, lines, and now figures."
lastModified: "2026-09-19T08:21:59.793Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---

## Children

| Title | Status |
|-------|--------|
| [A kind is a neighborhood: the city is a map drawn from the declaration, and everything in it has an address](./a-kind-is-a-neighborhood-the-city-is-a.md) | completed |
| [A lens is a drive-in: the picture stands at its kind's plot, and descending is walking up to the screen](./a-lens-is-a-drive-in-the-picture.md) | completed |
| [The seat is a robot in the city: it stands where it reads and writes, comes to your cursor when asked, and says its refusals at the gate](./the-seat-is-a-robot-in-the-city-it.md) | completed |
| [Who is where: other people stand at their drive-ins with their robots, over a presence channel that is not the op log](./who-is-where-other-people-stand-at.md) | completed |
