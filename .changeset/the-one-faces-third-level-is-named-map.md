---
"@graview/pages": patch
"@graview/embed": patch
---

The one face's third level is named Map: the control at the bottom left reads Page · Nearby · Map. "City" read to people as a place in the world rather than a way of seeing the whole app, and every word a person reads for that level now says Map — the third stop and the folded slider's word, the stops' tips and aria labels ("Map: every page and view of the app", "Nearby: this page beside its place on the map"), what is said aloud as the level changes, the Key and its keys line (1 Page · 2 Nearby · 3 Map), the legend's name ("What the map's marks mean"), the context menu's "Show on the map", and the embed's README. `LEVEL_NAMES` is `["Page", "Nearby", "Map"]`. Nothing a host calls is renamed: `one-place-city`, `@graview/core/city`, `sceneThumbnail`, every `data-testid` and every address stay as they were. Held by `one-face`'s `oneControlAtTheBottomLeftSaysTheLevel` and `draggingTheSliderScrubsTheLevels`, which now read Map.

Compatibility: unchanged on every surface; a host that reads the control's words reads Map where it read City.
