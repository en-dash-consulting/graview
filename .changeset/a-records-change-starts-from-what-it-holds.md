---
"@graview/core": patch
"@graview/pages": patch
"@graview/primitives": patch
---

A record's change starts from what the record holds. "Change the feature" opened with "—" in every field, on a record page and beside the act in the scene, so a person changing one fact could not see the others and a screen reader heard "Stage, —, pop-up button". Every field of the derived edit now opens on the record's value — a text, Markdown as written, a choice, money as it is typed ("12,500" beside its "$"), a date and how it repeats, a link, an app, and a record in another app — and only what was changed is sent, so saving one field leaves the rest as they were and the change says only that field. In the scene, how a date repeats is asked with the picker the pages ask with, never as a box to type in, and a choice the record holds is marked among the others (`aria-current`).

Compatibility: no surface changes. `@graview/core/forms` exports `editStart(mutation, graph, args)`, the record's values for the fields its derived edit asks, and `changedArgs(args, start)`, what a form that started there sends. Derived tool names and input schemas are unchanged.
