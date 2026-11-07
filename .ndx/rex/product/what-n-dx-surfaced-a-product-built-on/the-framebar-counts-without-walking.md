---
id: "cdb572e6-a881-4202-88f9-9d8301594aea"
type: "capability"
title: "The FrameBar counts without walking every node on each change"
slug: "the-framebar-counts-without-walking"
statement: "The FrameBar updates its counts from each change rather than walking every node in the graph."
criteria: [{"id":"c1","text":"When the graph changes, the FrameBar shall update its counts from that change rather than walking every node."},{"id":"c2","text":"While the scale harness runs on apps/discography, the render path shall hold its frame budget."}]
tags:
  - "n-dx"
  - "performance"
  - "bar"
source: "The review round before 0.1.22 (#207), 2026-10-11"
priority: "medium"
resolution: "Fixed in #215: the graph keeps a count per kind as records come and go (Graph.count), and the bar reads it instead of walking every record."
---

FrameBar walks every node on each change.
