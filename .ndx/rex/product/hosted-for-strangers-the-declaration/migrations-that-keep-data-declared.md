---
id: "2b5fa672-0b2e-40d3-8958-5b68ee742ba5"
type: "capability"
title: "Migrations that keep data: declared renames and type coercion in steps and migrationBetween"
slug: "migrations-that-keep-data-declared"
statement: "A product's migrations keep data across declared renames and type coercions, with migrationBetween emitting rename and coerce steps and stating per step what moves and what is lost."
criteria: [{"id":"c1","text":"When a field is renamed, the migration shall keep every value of that field and say in its words that the field was renamed."},{"id":"c2","text":"When a text field is coerced to a number, the migration shall keep the values that parse and count the values it cleared."},{"id":"c3","text":"If a renamedFrom names nothing in the previous version, graview check shall refuse it."},{"id":"c4","text":"When a declaration (TypeScript or document) says renamedFrom on a field, an edge or a kind, migrationBetween shall emit the matching rename-field, rename-edge or rename-kind step."}]
tags:
  - "graview-cloud"
  - "FR-01"
  - "operations"
source: "Graview Cloud docs/operations.md §4, 2026-10-02"
priority: "high"
---

WHAT IS THERE NOW: migrationBetween and ship's steps express a renamed field as a drop and an add, and a retyped field as a loss. MISSING: people change their app's shape often; their data should survive what it can. POSITION: a declaration (TS and document) may say renamedFrom on a field, an edge or a kind; ship gains rename-field / rename-kind / rename-edge and coerce-field steps (text→number when it parses, datetime→date, string→enum when the value is an option, value→list of one, and the reverse where lossless); migrationBetween emits them and states, per step, what moves and what is lost.
