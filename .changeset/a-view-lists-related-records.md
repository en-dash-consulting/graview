---
"@graview/core": patch
"@graview/primitives": patch
"@graview/pages": patch
"@graview/skills": patch
---

A view can list related records (FR-82). A to-many walk in a block flattened to "A, B and C" or a count, and nothing could draw each related record or link it. The `list` block now takes a walk from the record as its source in a card, a row or a page — `{ list: "out('includes')", as: "row" }` on a package's page lists its offers, each drawn with the offer's own row and each a link; `{ list: "in('answers')" }` on a note's row lists the offers that answer it. A row that lists records or says a figure is drawn as a block rather than a one-line pill. The list reads the graph the view is handed, which for a seat is what that seat may see (FR-55): a related record it may not see is not listed, not counted in "and N more", and opens no group heading of its own, and a list left with nothing says its `empty` words. Lists nest at most three deep (`MAX_LIST_DEPTH`); past that a list says its records' names, each a link, so a card that lists records whose cards list records — round a loop or down a long chain — always ends, and every expression keeps its own step budget. `graview check` holds a walked list's sort key and group to the kind the relation reaches, and refuses a walk along a relation no kind declares. Unit tests draw the LifeLogics document for an owner and for a partner who sees only the offers their firm delivers, and find the partner's package page, note rows, home counts and group headings saying nothing of the rest; `verify-declared` follows a listed record on both faces. `capabilities().shipped` names FR-82.

Compatibility: the declaration and check finding codes — additive within `graview-document@1`: a walk is a new source for the new `list` block, and nothing that compiled before reads differently. The wire — `capabilities().shipped` gains `FR-82`. Ops, stored formats and tool schemas are unchanged.
