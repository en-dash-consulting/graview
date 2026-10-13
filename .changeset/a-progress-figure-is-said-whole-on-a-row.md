---
"@graview/primitives": patch
---

A progress's figure is said whole on a row again. Since a row's text came to be clamped to one line, the clamp reached the figure under a progress bar too, and its height, 1.45 of the value's own ems, was shorter than a progress's line: "3 of 5" on the org app's skills and levels, at a phone's width, was cut at its foot (19 of 21 pixels) in Chromium and Firefox, and the progress's figure wrapped where it had been kept on one line (FR-113). A progress's figure is no prose: it is never clamped and never wraps. `pnpm verify quiet` holds `noTextIsCutOffOnTheFourScreens` again.

Compatibility: unchanged. `SPEC_VIEW_CSS` gains one rule, `.graview-spec-progress>.graview-spec-value`.
