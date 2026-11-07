---
id: "9363b216-bad2-49e9-b2d4-598aa1a40c25"
type: "change"
title: "0.1.34 · FR-184: A panel drawn from the right-click menu opens in the face it was asked on"
slug: "0-1-34-fr-184-a-panel-drawn-from-the"
intent: "Roadmap f-menu-panel-in-its-face (FR-184, priority now). The at-pointer menu is drawn outside the routed face, so useInlineEnv's useGoTo() never sees Pages' GoesByAddress: goTo.draft is undefined and drawPanel's draft waits for the scene, where it is drawn as a bare list. The menu's inline AI must use the goTo of the face the menu was opened on (MenuTarget.face)."
acceptanceCriteria:
  - "\"Draw a panel\" (and takeOffer of a panel offer, and the quick ask card) from a menu opened on Pages lands on /~draft with Keep as a lens and Discard, and never switches face; a test fails without the fix"
  - "on the scene a drawn draft is framed on the scene surface like a panel, not a bare list on the ground with the district inspector open"
  - "a failed ask from the menu is said where it was asked, not only in Activity"
touches:
  - "0853f952-c9bf-4392-8052-bcfddbf25d59"
priority: "critical"
tags:
  - "roadmap"
  - "graview-cloud"
  - "0.1.34"
source: "ndx-capture"
---
