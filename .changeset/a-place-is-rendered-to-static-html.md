---
"@graview/pages": patch
"@graview/core": patch
---

A place is rendered to static HTML off the browser (FR-174). `renderPlace(store, declaration, place, { viewer, look, today, base })` on the new entry `@graview/pages/static` answers `{ html, css, title, found }`: a kind's list, a record, a declared place or the home as one self-contained document in the app's look — its brand's tokens, type and shape inlined as CSS, light unless asked or declared otherwise — with no script, no form and nothing to fetch. It says what `describePlace` says the place shows that seat, a record's describe line under its name, its facts in its page's sections and its relations in the declaration's words, each listed record by its card or row (or its glance), and puts each section of a place — a board's column, a roster's week — on a page of its own in print. A record the viewer may not see, a kind kept from them and an address that names nothing are answered alike, `found: false`. The entry imports no React, router or face, so a Worker renders a fixed link — a schedule as a PDF, a roster — on each change without a DOM; nothing on a hosted page imports it. `staticCss(brand, scheme)` is the sheet alone.

`describePlace`'s derived home no longer counts a kind kept from the seat — an administered module's people for a member, a kind the seat sees none of — or a disabled module's, as the routed home never listed them.

Compatibility: additive. `@graview/pages/static` is a new entry, and `capabilities().shipped` gains FR-174. `describe_place` says one line fewer on the home for a seat a kind is kept from.
