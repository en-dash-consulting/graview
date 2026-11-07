---
id: "a9e5eeb4-5a37-48d6-b0f4-c88bded909ff"
type: "change"
title: "0.1.44: A compacted store shows a seat only what it may see, history judged for one seat, and views that stand in the nav."
slug: "release-0-1-44"
intent: "What 0.1.44 shipped, recorded after the release from its entry in apps/site/releases.json. The work itself was tracked on the Graview Roadmap app."
acceptanceCriteria:
  - "A security fix for compacted stores. A store opened from a checkpoint could serve a seat the id of a record removed before the checkpoint, inside a field of a record the seat may see. The checkpoint now keeps what it needs to judge that, and an older checkpoint fails closed."
  - "History judged for one seat. `archivedSeenBy` serves a range of the archive, with its checkpoints, as one seat may see it."
  - "A view stands in the nav. A view the host keeps can be ordered among the places and opened first; a kind kept off the places leaves the Pages drop-down and stays reachable at its address."
  - "The two-scheme logo has a capability id and one public reader."
  - "The Nightly's engines leg looks twice before it fails, and keeps its verdicts."
shippedIn: "0.1.44"
tags:
  - "backfill"
  - "0.1.44"
source: "apps/site/releases.json"
---
