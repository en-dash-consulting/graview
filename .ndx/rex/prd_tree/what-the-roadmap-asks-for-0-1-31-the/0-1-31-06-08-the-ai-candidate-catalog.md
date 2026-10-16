---
id: "e493f990-e60a-44ca-b399-d6f6dae7188f"
level: "task"
title: "0.1.31 · 06+08: The AI candidate catalog, context assembler, Fast/Thinking provider slots and ghost layer, with AI interactions in Activity"
status: "pending"
priority: "high"
tags:
  - "roadmap"
  - "graview-cloud"
  - "0.1.31"
source: "ndx-capture"
acceptanceCriteria:
  - "the catalog and context state for any target come from a pure, tested function, and no candidate the viewer cannot see or run is ever offered"
  - "stub Fast and Thinking providers drive a menu suggestion, a generated panel and a ghost end to end, and a panel can be pinned into a real lens"
  - "an interaction appears once in Activity with its outcome and undo, and the AI filter, the record view and the person view show it"
  - "when the host says AI is off, no AI part is drawn on either face"
description: "Roadmap f-ai-candidate-catalog (08) and f-activity-ai-entries (06): the framework parts of the inline AI (feature:inline-ai-in-the-context-menu-directed-by-jev). Jev (TypeSafe) is the decided Fast model; Clef stays a possible alternative behind the seam. Built together because Activity's AI entries record what the catalog offers and the ghost layer applies. Catalog: for a target (record, selection, field, list or lens, act, place) derive the valid options with ids and one-line descriptions: acts the viewer may run there, block/panel templates per kind, places and neighbor records, field-fill options. Context assembler: compact JSON state (place, target, selection, 1-hop neighbors, recent actions, schema digest cached per document version), under the viewer's sight. Two provider slots on the host seam: Fast (typed decisions, shaped for Jev's state + typed questions) and Thinking (an LLM); each call reports tier, model and tokens for metering. Ghost layer: proposed fills, links, records or lenses previewed with Accept / Accept some / Dismiss, then one-batch Undo; accepted ops carry lineage ai:<interaction>. Activity (packages/primitives workbench activity.tsx): an interaction entry (who, when, target, what was asked, offered, accepted or dismissed, resulting op batches undoable from the entry, model and cost when supplied), an AI filter (all / changes / AI), the feed scoped to a record and to a person, reopen a generated panel or re-run a suggestion, and a host seam to supply stored entries (Cloud's half is f-ai-interaction-history). AI-off from the host hides every AI part, not disables it."
lastModified: "2026-10-16T04:36:20.387Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
