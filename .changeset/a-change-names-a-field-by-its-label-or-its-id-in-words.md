---
"@graview/core": patch
"@graview/tools": patch
---

A change's summary names a field by its declared label, or its id in words, never half lowered: setting `appleMusic` on an app that labels it "Apple Music" read "Changed the apple Music of Blue"; it reads "Changed the Apple Music of Blue", and "Changed the apple music of Blue" where nothing labels it. `fieldInPassing(definition, key)` and `nameInPassing(text)` (the main entry) say a field mid-sentence — a label written as a name ("Apple Music", "TikTok") kept as written, one that reads as words ("Release date") lowered, an acronym kept ("source URL") — and the edit act's summary and description, a board's "No …" column, the structure provider and the tidying bases use them. Test: `a-change-names-a-field-by-its-label-or-its-id-in-words`.

Compatibility: ops and primitives — unchanged; the summary is an op's `intent`, worded when the op is made, so ops already written keep theirs. Stored formats — unchanged. The wire — unchanged. The declaration and check finding codes — unchanged. Derived tool names and input schemas — names and schemas unchanged; the derived edit's description names a field whose label is a name as written ("Change what was set when this album was made: name, Apple Music").

What Graview Cloud does: nothing; a change made after it updates is said with the field's label.
