---
"@graview/guest": patch
"@graview/pages": patch
"@graview/skills": patch
---

A view of one record that replaces its page may draw its own heading (Roadmap f-replacing-view-own-heading). A view with `cardinality: "one"` and `replaces: "page"` that titled the record itself still had the record's head drawn over it — the name, the line its kind's `describe` says, "In the scene", "Notify me", "Seen in" — so the name was said twice, and `heading: "own"` was refused on a view of one. It is now taken there: on such a view the record's page draws none of its head over it, and the record's name is still the page's one heading, said to a screen reader and the keyboard only. The trail stays, so a person keeps where they are, and a view that says `bleed: "full"` as well starts right under the bar, as a place's does. `heading: "own"` on a view of one that does not replace its page is refused, saying so.

`replaces: "page"` does not imply `heading: "own"`. A replacing view that draws no title of its own would leave its page with none a person can see, so the default keeps the head, as it was, and a view that titles its record says `heading: "own"`. The graview-pages skill says it where it says `heading`.

Tests: `a-view-that-draws-its-own-heading-is-not-titled-twice` (guest) takes `heading: "own"` on a view of one that replaces its page and refuses it on one that does not, draws the head over a replacing view without it as before, and over one with it draws one page title, unseen, holding the name alone, with no "In the scene" and no asides.

A hosted page's first load grows by 0.2 KB up front (0.3 KB handed a compiled app), with what the select's pick and the undo's sentence add beside this (`scripts/budget-raises/replacing-view-own-heading-hosted-page.json`). Every face grows by 1.0 KB, Cloud's worker by 0.8 KB, a visitor's form by 0.3 KB, and the guest host registering a worker view and drawing one on the open kit by under 0.1 KB each, under a raise of their budgets.

Compatibility: ops and primitives — unchanged. Stored formats — unchanged. The wire — unchanged. The declaration and check finding codes — unchanged; a worker view's manifest now takes `heading: "own"` on a view of one record that says `replaces: "page"`. Derived tool names and input schemas — unchanged.

What Graview Cloud does: `propose_view` now passes a view of one record with `replaces: "page"` and `heading: "own"`; a view that draws the record's name as its own heading can say it, and its page shows the name once.
