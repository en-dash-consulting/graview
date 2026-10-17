---
id: "e493f990-e60a-44ca-b399-d6f6dae7188f"
level: "task"
title: "0.1.31 · 06+08: The AI candidate catalog, context assembler, Fast/Thinking provider slots and ghost layer, with AI interactions in Activity"
status: "completed"
startedAt: "2026-10-16T14:02:57.000Z"
completedAt: "2026-10-16T14:52:53.000Z"
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
lastModified: "2026-10-16T14:52:53.000Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---

## Notes

### 2026-10-16

Built, in commit 294f1813c:

- **Catalog and context state** on a new entry, `@graview/core/catalog` (listed in core's exports, AGENTS.md and the main-entry test): `catalogOf(store, target, { principal, acts?, places? })` derives, for a record, a selection, a field, a list, a lens, an act or a place, candidates with an id and one line — acts the viewer may run (the derivation's own when a face hands them, else the target's subject acts; each held to the policy, rehearsed when it asks nothing, never a destructive one), panels per kind (a list; grouped by and columns of each choice; sorted by each number or date; a calendar of each date), places, neighbor records, and fills (a choice's or boolean's values, and links a connecting act may make, each rehearsed as the viewer). `aiContextOf` assembles the compact state (place, target with its seen fields, selection, one-hop neighbors, recent batches, a schema digest cached per schema object and seat). Both read `store.seenBy(principal)` and `kindsKeptFrom`; tested in `the-ai-catalog-offers-only-what-the-viewer-may-see-and-run`.
- **Provider slots** on `HostAi`: `fast` (Jev's shape, `{ model, decide, price? }`; `jevFast()`), `thinking` (`{ model, think({ system, prompt, state, catalog }) }`), `off`, `interactions` (`{ load, keep }`) and `meter`. Unsaid, `decide` and `complete`/`turn` serve the slots. Engine and stubs on `@graview/tools/inline-ai`: `suggestHere`, `fillHere`, `recordHere`, `panelHere`, `ghostOf`, `acceptGhost`, `acceptedEntry`, `dismissedEntry`, `stubFast`, `stubThinking`. Each call reports tier, model, tokens and cost.
- **Ghost layer**: a proposal is rehearsed as the person and said in the act's sentence; Accept / Accept N of M / Dismiss; one batch with lineage `{ basis, model, confidence, interaction }` (new `Lineage.interaction`) and `via: ai:<interaction>`; Undo on the tray. A panel is a draft (`recipeDraft`) drawn where the seat's are, and "Keep as a lens" keeps it. Decided not to reuse the tidying actor's `suggest` (that writes a shared op every viewer sees); the ghost is the asker's own until accepted.
- **Activity**: `AiInteraction` entries from a per-app desk (`aiDesk` on the provider), the batch drawn in its entry not beside it, filter All / Changes / AI and "Just mine", undo per batch, "Ask again" and "Show the panel"; a record's page lists what AI did there (`RecordInteractionsDoor`, also in todo's own design). Rows fetched lazily.
- **AI off**: `ai: { off: true }` is normalized to nothing but `off` in the provider; the menu section, the ghost, the ask field, the entries and the filter are not drawn on either face.
- **Harness** `pnpm verify inline-ai` (docs/inline-ai.json): 10 claims, passing in chromium, firefox and webkit, watch clean; todo takes stubs at `?ai=stub`, off at `?ai=off`. The graview-desk skill says it in one section. Budgets raised by files in scripts/budget-raises/ (1.3 KB up front on a hosted page); the before-draw literal is 922 KB.

Left for later: quick-ask and answer cards (task 09) build on `askInline`/`takeOffer` in `@graview/primitives`' inline-ai-menu, the catalog and the slots; nothing in the framework stores entries past the page — that is Cloud's `f-ai-interaction-history` through `ai.interactions`. The harness drives the record proposal (`recordHere`, "Add one with AI") only in unit tests.
