---
"@graview/studio": patch
---

The studio keeps a kind's `display.glance` through its round trip — in the declaration it hands back and in the files it writes — where it dropped it, and the checker then noted `glance-unchosen` on a kind that had chosen.
