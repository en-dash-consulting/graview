---
"@graview/primitives": patch
"@graview/embed": patch
---

The workbench can be found by its headings. The seat, the inspector at the pointer, the activity and the places each open with a heading named as their landmark is, so a screen reader moving by headings reaches every region a person goes to.

An embed's workbench says its name in a heading too. axe's `page-has-heading-one` failed on every embedded workbench in both schemes. `mount({ heading })` sets the level: `1` when the host's page is the app, `2` by default inside somebody else's article, and `false` when the host's own heading names it. The pages face has its own h1 and is not given a second (FR-25).

Compatibility: unchanged for ops, formats, the wire and tools. `EmbedOptions.heading` is a new optional field, and an embed with no `heading` now carries an h2, which is not visible on the page.
