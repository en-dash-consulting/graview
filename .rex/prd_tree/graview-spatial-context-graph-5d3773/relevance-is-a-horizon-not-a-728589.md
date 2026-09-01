---
id: "728589e4-9119-4197-8a06-6f180e78be03"
level: "feature"
title: "Relevance is a horizon, not a delete: lifecycle, archival, and the sync flood"
status: "pending"
priority: "high"
tags:
  - "lifecycle"
  - "archival"
  - "sync"
  - "scale"
  - "schema"
source: "Nick, 2026-09-01: \"how to handle expired/irrelevant/archived entities within these nodes, esp when we start doing things like syncing google calendar... it would need to create an Exception entity for so many things, it'd get so overwhelming\""
acceptanceCriteria:
  - "A kind can declare a LIFECYCLE role — a status field or an until-date that says when a node stops being current — the way it already declares label and plural roles, and graview check verifies the declaration"
  - "Every derived surface aggregates over the HORIZON by default: counts, tallies, kind cards, districts, rosters, lenses and invariants see current nodes; retired ones are one deliberate step away ('5, +12 past'), never gone and never shown by accident"
  - "Widening the horizon is a view state — a URL, a stop, tweenable — not a settings toggle: 'show me the retired ones' is a place you go and come back from"
  - "Archival is an op-log move (a retire op with an inverse), so nothing is deleted, everything is attributable, and un-archiving is ordinary undo-shaped work"
  - "Machine-authored bulk artifacts collapse: ops already carry their author, so a sync's 23 occurrence adjustments roll up into one legible entry with the individuals one step in, while human-intent exceptions stay first-class and individually visible"
  - "A sync-shaped stress fixture (a generated month of external-calendar churn) proves the interface stays legible: shelf counts, the overview city and the problems list all read correctly at hundreds of retired/synced nodes"
  - "Invariants can scope to the horizon by default and opt into judging the past explicitly — a rule about this week must not fire about last year"
description: "The graph accumulates; the interface must not. Today every node a kind holds counts, renders and weighs the same forever, which already pads counts with the past and becomes untenable the moment an external sync arrives — a Google Calendar integration minting a first-class Exception node per external quirk would bury the household's own decisions under machine noise.\n\nPOSITION (three moves, none of them deletion):\n\n1. RELEVANCE IS A QUERY-TIME HORIZON. The op log's whole philosophy is that nothing vanishes; what changes is what the interface is looking at. A declared horizon — per app, refined per kind via a lifecycle field role (status, or effectivity dates, which constraints already carry as from/until) — bounds every derived surface by default. 'Current' is a definition the declaration makes and graview check can verify, not a convention each view reimplements.\n\n2. THE PAST IS A PLACE, NOT A TRASH CAN. Widening the horizon is ordinary view state: a stop with a URL that shows the retired runs or last season's fixtures, entered deliberately and left cleanly. Counts advertise what is behind the veil ('5, +12 past') so archived never means invisible-and-forgotten. Retiring is a mutation with an inverse — the household example's retire/unretire agreement pair is the existing miniature of the whole design.\n\n3. PROVENANCE SEPARATES SIGNAL FROM FLOOD. Ops carry authors. A human's 'skip the nap on Thursday' is intent and stays a first-class node; a sync's per-occurrence adjustments are mechanical consequences and should land compactly (an occurrence-override collection on the recurring node, or shadow records auto-scoped out of the horizon) and roll up in the interface — one '23 adjustments from calendar sync' entry, individuals one step in. The rule of thumb: a node kind earns first-class cards when a person will ever select one to act on it; everything else is a field.\n\nDesign tensions to resolve in implementation, not assumed: whether horizon filtering lives in GraphReader (one enforcement point, touches everything) or in the derivation layer (safer, partial); whether sync arrives through @graview/ship adapters (likely, and this feature is its data-model prerequisite); how the overview city shows mass without noise (a district's retired depth as foundation rather than height?). Ties into: ship (sync adapters and migrations), the blank-graph onboarding app (a horizon is meaningless until data ages), graview-saas (tenant data grows forever), and the traditional face (list pages need the same horizon)."
---
