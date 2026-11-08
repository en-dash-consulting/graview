---
id: "39f210b1-71c7-49c6-934d-3730e8600cd0"
type: "change"
title: "0.1.43: A change carries its value once less: smaller histories for every app."
slug: "release-0-1-43"
intent: "What 0.1.43 shipped, recorded after the release from its entry in apps/site/releases.json. The work itself was tracked on the Graview Roadmap app."
acceptanceCriteria:
  - "A saved change no longer keeps its own undo copy. It was always worked out from what changed; now it is worked out when undo, playback or a rebase needs it, instead of being stored and sent. An image field's change is about 40% smaller, and a whole history of image edits about 38%."
  - "Nothing old breaks. A store written by an earlier version opens and carries on; exports from earlier versions import and undo the same; a tab on an earlier version is still sent each change with its undo copy written out."
shippedIn: "0.1.43"
tags:
  - "backfill"
  - "0.1.43"
source: "apps/site/releases.json"
---
