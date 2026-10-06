---
"@graview/guest": patch
---

The README names `refused` as a headless run's own reason, not the page's. A page that cannot start a view says `start` (FR-102); a headless run says `refused` when its isolate could not be hardened or something called the script's entry before the host did, and the README listed it among the page's reasons.

Compatibility: unchanged — the README only.
