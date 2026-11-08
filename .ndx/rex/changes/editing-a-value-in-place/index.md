---
id: "6bef8548-8c26-404a-bbea-283a6d5a6ad3"
type: "change"
title: "Editing a value in place"
slug: "editing-a-value-in-place"
intent: "Reading a node closely is when you most want to change it, and there is no way to edit a field from the interface — only whole mutations with named arguments. A field the schema declares as editable should be editable where it is shown, and the edit should still go through a mutation so it lands in the log with an author.\n\nJacking in was read-only by accident until the strip was lifted above it; that is fixed, but the actions still only offer named mutations rather than \"change this text\"."
acceptanceCriteria:
  - "A field shown in a detail view can be edited in place where a mutation exists that writes it"
  - "The edit runs that mutation, so it appears in the log and can be undone"
  - "A field with no mutation that writes it is visibly read-only rather than silently inert"
  - "The framework finds the writing mutation from the declaration — no per-field wiring in an app"
touches:
  - "2b687f3c-6253-4b93-86cf-0e592ae9fcdf"
priority: "high"
---
