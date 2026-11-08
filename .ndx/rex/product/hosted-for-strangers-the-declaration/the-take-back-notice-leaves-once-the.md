---
id: "3938df11-4bf2-41d2-9f82-895208f3939a"
type: "capability"
title: "The \"Take back\" notice leaves once the act is settled, and can be closed (FR-152)"
slug: "the-take-back-notice-leaves-once-the"
statement: "After an act on Pages or the scene, the \"Take back\" notice stays only while the act can be taken back without thought, and a person can close it with a keyboard-reachable control."
criteria: [{"id":"c1","text":"While an act can be taken back without thought (a few seconds, until the next act, or until a move to another page), the \"Take back\" notice shall stand, and when that time ends the notice shall go."},{"id":"c2","text":"The \"Take back\" notice shall carry a close control that a keyboard reaches."},{"id":"c3","text":"When the \"Take back\" notice has gone or been closed, the product shall keep taking back reachable from history/activity."},{"id":"c4","text":"Pages and the scene shall show the \"Take back\" notice alike, with the same lifetime and close control."}]
tags:
  - "graview-cloud"
  - "FR-152"
  - "pages"
  - "notices"
source: "Graview Cloud, 2026-10-10 (the framework brief after 0.1.20, ../graview-cloud/docs/framework-brief-0.1.21.md)"
priority: "high"
resolution: "Fixed in #195: the Pages offer goes after 10 s (held while pointed at or focused), with the next act, a move to another page or its × close; Cmd/Ctrl+Z still takes back."
---

After an act on Pages, the notice offering "Take back …" stayed at the foot of the picture for the rest of the session: it never faded and nothing on it closed it, so every page carried a stale offer.
