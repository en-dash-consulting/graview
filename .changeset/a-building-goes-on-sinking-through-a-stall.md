---
"@graview/react": patch
---

A building that rises or sinks while the history is played goes on from where the last frame drew it when a frame comes late, as the one face's camera already does. A transition is clocked by the wall, so on a slow machine one long frame while a building sank (230 ms on a runner's software GPU) took it from nearly full to flat at once, and it was never seen coming down. Now a gap past 34 ms between two frames is taken out of the rise or the sink under way, and a building still sinking is not taken away by the clock kept for where no sink plays.

Held by one-face's `aRemovedRecordComesDown` on the GPU leg.

Compatibility: the wire, stored formats, ops and primitives, derived tool names and input schemas, and the declaration and check finding codes are unchanged. What Graview Cloud does: nothing.
