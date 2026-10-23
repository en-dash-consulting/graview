---
"@graview/tools": patch
---

What the seat offers before anybody asks is called an offer, so it is no longer mistaken for a suggestion of the app's own actor. `@graview/tools/suggest` had its own `Suggestion` beside `@graview/core/tidying`'s, which is a change waiting in the log; its `Suggestion`, `SuggestionWhy`, `SuggestInput` and `suggestionsFor` are now `Offer`, `OfferWhy`, `OfferInput` and `offersFor`. What they hold and do is unchanged.

Compatibility: breaking for an import, before 1.0 — a host that imported the four names from `@graview/tools/suggest` imports the new ones. Ops, stored formats, the wire, the document format and tool schemas are unchanged.
