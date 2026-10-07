---
"@graview/core": patch
"@graview/primitives": patch
"@graview/pages": patch
"@graview/embed": patch
"@graview/skills": patch
---

Named edits for the app's name, its description and every key of its brand (FR-125). From Graview Cloud: a chat renamed an app with a raw JSON Patch on `/name` it had to discover, and nothing said whether either face drew the document's description. `set-brand` takes every brand key — `logo`, `favicon`, `typography`, `shape`, `accents`, `scheme` beside `accent`, `name`, `currency` and `locale` — and `null` clears one (a part of `typography`, `shape` or `accents` too); `set-name { name }` and `set-description { description }` are edits of their own. Each says what it did and `diffDocuments` says it in words: "The app is now called "…", where it was "…".", "The line under the app's name reads "…".", "The logo changes.", "Headings are now set in system-serif.", "Corners are now 6px.", "The app opens dark when the reader has not chosen." A mark or a face the checker would refuse is refused at the edit, by its path. The description is drawn as the line under the app's name — on the routed face's home, under the masthead, and in the embed's strip at a desk's width — wrapping, never cut. `describePlace("home")` says the masthead (`DescribedMasthead`): the name, the line under it, and the logo by its alt text (the app's name when none is given) and how it is drawn.

Compatibility: `EDIT_OPS` gains `set-name` and `set-description`. `DocumentDiff`'s sentence for a renamed app and for a changed description is new words; a program matching "The app is renamed from" or "The app's description change" no longer finds them. `PlaceDescription` gains optional `masthead`, and the home's `text` gains a "Masthead:" line after its first. `set-brand { name: null }` now clears the wordmark's name, and a brand left holding only a name is kept (it is drawn). `capabilities().shipped` gains FR-125.
