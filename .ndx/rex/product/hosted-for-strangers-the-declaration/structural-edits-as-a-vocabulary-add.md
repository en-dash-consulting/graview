---
id: "4b82ad98-4915-44c0-9914-16ddc0e55591"
type: "capability"
title: "Structural edits as a vocabulary: add, rename, retype, remove — and a rename rewrites every reference"
slug: "structural-edits-as-a-vocabulary-add"
statement: "Structural edits to an app's declaration go through a closed editDocument vocabulary, so that a rename rewrites every reference to the renamed kind, field or relation and the result says in words what changed."
criteria: [{"id":"c1","text":"The system shall ensure that rename-field quote→price rewrites rules, describe templates, writes lists and view specs, and the compiled app checks clean."},{"id":"c2","text":"The system shall ensure that every edit has a sentence in the result."},{"id":"c3","text":"The system shall ensure that the studio and editDocument produce the same document for the same change."},{"id":"c4","text":"The system shall ensure that the rule language ships parse → rename → print (printExpr) and a name walk that knows which kind each bare name reads from."},{"id":"c5","text":"The system shall ensure that A relation rename applies to every kind that declares that relation (relation names are app-wide)."},{"id":"c6","text":"The system shall ensure that acts whose names derive from a renamed kind or field are renamed with their grants and repairs, and the result says the tool interface changed."},{"id":"c7","text":"The system shall ensure that breaking is judged by the migration plan's counts (values cleared, records or links removed), not by the kind of edit; fill values for existing records travel with the edit (FR-22)."}]
tags:
  - "graview-cloud"
  - "chat"
  - "FR-01"
  - "FR-34"
source: "Graview Cloud chat seamlessness, 2026-10-02"
priority: "high"
---

WHAT IS THERE NOW: the studio edits a declaration through its own acts (add field, rename kind…) on its meta-graph; a document is edited by whole replacement or JSON Patch, where renaming a field means finding every rule, template, act, lens and grant that names it — the step models (and people) get wrong. MISSING: structural change as safe as data change. POSITION: editDocument(doc, edits[]) with a closed vocabulary — add-kind, rename-kind, remove-kind, add-field, rename-field, retype-field, set-options, set-required, remove-field, add-relation, rename-relation, remove-relation, add-act, remove-act, add-rule, remove-rule, set-brand, set-view — where every rename sets renamedFrom (FR-22) and rewrites references in rules, templates, acts, sights, grants, lenses and views; the result is a document plus the words that say what changed; the studio's acts and this vocabulary are the same operations.
