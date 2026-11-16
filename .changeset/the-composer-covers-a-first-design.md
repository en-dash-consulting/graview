---
"@graview/core": patch
---

The composer covers what a host's first design does. Graview Cloud tried putting its first design on `homeFromDeclaration`, `rowFromDeclaration` and `glanceFromDeclaration` and held it, because on its supper template its own composition read better: guests and dishes got no row, a dish did not say whose it was, guests were in no order, past times stayed on the home, a list ran on, and the headline counted three kinds. Now, on `@graview/core/compose`:

- every named kind is given a row and a glance, not only a kind with a date or a status. A row says the record's name, then its date as a glance says it, its choice (its status, else its first single choice: a guest's RSVP, a dish's course) and the record it belongs to, each only where the record holds it; a kind with none of these says the first other fact a glance would. A kind with nothing past its name keeps the derived row;
- a row names the record it belongs to ("Pumpkin pie · Dessert · The Riveras"), read by `belongsTo(document, kind)`: a relation to one record of one other kind of the app (`cardinality: "one"`, a single `to`), which groups the kind as a foreign key would, and not one to the kind itself, to another app, to a choice of kinds, or a pair where the other kind holds one back. Of several, the one a rule over the kind requires comes first. A document's relation cannot be marked required, so these are what a declaration says of belonging;
- a list of an undated kind is in its choice's declared order (`sort: { by, direction: "choices" }`, `choiceOfKind`), guests by their RSVP;
- a list of a dated kind says what is next: `where not (<date> < today())`, so a record with no date stays, soonest first, and "No <plural> ahead." when nothing is;
- a dated list holds five records and any other ten (`MOST_DATED_LISTED`, `MOST_LISTED`);
- the headline counts up to five kinds (`MOST_COUNTED`), the most linked first, as many as fit the 300 characters a template may be, in words where they fit and in figures where more do, still counting only kinds every seat sees under `policy.sees`;
- `composeDesign` on a document no longer designs a `people: true` kind: its records are the members, and none of the three proposes a row, a glance or a home list for it.

Held by a unit test of core (`the-composer-covers-a-first-design`), with the composer's earlier tests moved to the new rows, lists and headline, and every app, recipe and template the composer test reads still compiling with no warning once composed.

Compatibility: the declaration and check finding codes — unchanged: every edit is one a build before it accepts. The JavaScript API is additive: `belongsTo`, `choiceOfKind`, `MOST_COUNTED`, `MOST_DATED_LISTED` and `MOST_LISTED` on `@graview/core/compose`. What a composed design looks like changes: a host composing one gets a row and a glance for every named kind, a row that names the record it belongs to, home lists from today on and in their choice's order with five or ten records, a headline of up to five kinds most linked first, and nothing proposed for the people kind; a design composed and kept before is not touched. Ops and primitives, stored formats, the wire, and derived tool names and input schemas — unchanged. What Graview Cloud does: delete its own composition and keep only its accent and its `| glance` rollout guard.
