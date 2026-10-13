---
"@graview/studio": patch
---

The studio keeps an app-link and a rule that reads the clock (the ninth walk, W-199). Written back from the studio, a field declared `appLinkField()` (FR-171) came back as the string with a length and a pattern its zod is, which every face draws as text, and a rule that is a function and says `readsTheClock: true` (FR-176) came back without it. `studio.files()` now writes `appLinkField()` and imports it, and the studio's rule kind carries `readsTheClock` ("reads the clock") from the checkout to the files and to the declaration it hands back.

Compatibility: the studio's meta-schema gains the optional rule field `readsTheClock`; the files it writes may import `appLinkField` from `@graview/core`.
