---
id: "ec3f4964-e40c-49f5-bc42-912336a8904a"
type: "change"
title: "A log can be folded from a base: epochs across declaration changes"
slug: "a-log-can-be-folded-from-a-base-epochs"
intent: "OperationLog folds only from empty, so a log that spans a declaration change (ops naming a kind or field the current declaration no longer has) cannot be refolded to verify a snapshot. Cloud records a 'base' graph at each reload/restore and folds from it. POSITION: the log carries epochs — a checkpoint at each declaration version — and fold(from: checkpoint) is public; verify() and compaction (FR-23) build on it."
acceptanceCriteria:
  - "A store whose log spans two declaration versions verifies by folding from the last epoch"
  - "Undo across an epoch boundary is refused with a sentence naming the change"
priority: "high"
tags:
  - "graview-cloud"
  - "operations"
  - "FR-23"
source: "Graview Cloud self-healing room, 2026-10-02"
---

Migration suggestion (text claude-sonnet-5-5, not accepted): place on "A store can prove its own fold: a deterministic snapshot hash and store.verify()" (82d172be-19b2-4a98-9bff-7df8adc8499e).
