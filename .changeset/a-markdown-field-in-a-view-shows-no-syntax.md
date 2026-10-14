---
"@graview/core": patch
"@graview/primitives": patch
"@graview/pages": patch
---

A Markdown field named in a view never shows its syntax, a row's glance is two lines at most, and a first sentence ends at a code-ish word's stop (FR-180). A declared `{ "text": "{body}" }` block printed the field as written — "## Plan", "**Friday**" — where the record's own page drew it as prose: a text block that is a Markdown field alone is now drawn as Markdown on a page (the resolved block carries `markdown: true` and the text as written) and said by its start in a card or a row; named beside other words, or in a title or a badge, it is said as its words with the syntax taken out, on every face and in `describe_place`. A filter (`{body|excerpt}`, `{body|upper}`) says it as before. The 0.1.28 brief's row ran four lines in the glance column; the glance is now clamped to two, like the row's name. And "capabilities().shipped." was taken for an abbreviation, so an excerpt ran on into the next sentence: only short letters between stops ("e.g.", "U.S.", "Ph.D.") and the usual titles ("Dr.") are abbreviations now, and a word like "graview.dev." ends its sentence.

Compatibility: a resolved text block (`resolveBlocks`, `@graview/core/blocks`) may carry `markdown: true`, and `BlockContext` takes `glance` (set by `blockContextFor` for a card or a row); a block about a field that is not Markdown resolves as before. What a card, a row or a describer says of a Markdown field named bare in a template changes from the text as written to its words. The document format, check finding codes, ops, stored formats, the wire and tool schemas are unchanged.
