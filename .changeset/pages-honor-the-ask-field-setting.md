---
"@graview/pages": patch
"@graview/embed": patch
"@graview/skills": patch
---

Pages honors the app's setting for the AI it offers in place. An embed mounted with `seat: "hidden"` drew no ask field on the scene and one on every page anyway: the routed face drew its own without reading the setting. In this release the ask field itself gives way to the quick ask (see "The quick ask replaces the Ask box"), and its setting, `quickAsk`, is read by both faces alike: the embed hands it to the scene and to every page, and `handle.setQuickAsk(on)` changes it on whichever face is open, on a phone and a desk, without mounting again.

Compatibility: no surface changes beyond those the quick ask's changeset names.
