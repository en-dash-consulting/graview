---
"@graview/core": patch
"@graview/primitives": patch
"@graview/skills": patch
---

A headline bound to a long field is warned of, and drawn a step smaller. `{"headline": "{call}"}`, where a call is three sentences, filled a focus card at display size: a headline is a few words, drawn large, and nothing said a long text did not belong there. Now `graview check` warns, `view-headline-long`, where a view's headline block binds a long field whole — a document's `text` field, Markdown among them, or a string declared in code longer than 500 characters, as `view-whole-text` reads them — "incident page heads it with call, a long text, drawn at a headline's size; a headline is a few words.", and the fix says it in a text block, `{"text": "{call}"}`, or heads it with `{call|excerpt: 60}`; an excerpt and a short field say nothing. And a headline past 90 characters says so (`data-long` on `.graview-spec-headline`) and is drawn at a heading's size, 1.125rem whatever its level, clamped to four lines, every word still in the page for a reader that does not see it. The `graview-view-specs` skill says so. A hosted page that compiles its document carries 0.4 KB more up front (0.1 KB gzipped), the check's own words, and its scene face before it draws 0.6 KB more; one handed a compiled app carries nothing more.

Compatibility: ops, stored formats, the wire and derived tools are unchanged; every declaration that compiled still compiles. The check finding codes gain `view-headline-long`, a warning. `SPEC_VIEW_CSS` gains `.graview-spec-headline[data-long][data-level]`. What Graview Cloud does: nothing; a view a chat wrote with a long field as its headline is now drawn smaller, and the warning is there for its own check to show.
