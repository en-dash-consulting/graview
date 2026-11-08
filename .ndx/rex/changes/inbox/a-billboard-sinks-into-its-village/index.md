---
id: "d71053b9-3f51-4505-b75f-d45c160303fb"
type: "change"
title: "A billboard sinks into its village when another rises: no two pictures over each other mid-tween"
slug: "a-billboard-sinks-into-its-village"
intent: "Switching from one lens to another at altitude left the old billboard standing at full size, fading in place under the new one for the length of the tween, because a leaving screen (an aggregate node) had no stand-in: its members are buildings on the ground, not nodes. The stand-in for a screen is its kind's card, so a leaving picture shrinks into its village's signpost and board and the next one grows out of its own."
acceptanceCriteria:
  - "interpolate(): a node with screenOf leaving stands in at kindCardId(screenOf) in the destination, sized to that card; entering grows from the same in the source"
  - "Mid-tween after switching showings across kinds, the leaving screen is smaller than it was and centred toward its kind card (unit test)"
  - "Navigation harness: no two [data-graview-screen] hosts at full size 120ms after a switch"
priority: "high"
tags:
  - "graview"
  - "city"
  - "drive-in"
  - "altitude"
source: "Nick: \"Lenses should open and close properly upon navigation, not leaving stale billboards up as we shift from one lens to another\""
---
