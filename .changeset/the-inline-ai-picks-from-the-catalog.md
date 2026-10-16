---
"@graview/core": patch
"@graview/tools": patch
"@graview/react": patch
"@graview/primitives": patch
"@graview/pages": patch
"@graview/embed": patch
"@graview/skills": patch
---

The inline AI picks from what the app already knows, previews before it keeps, and leaves an entry in Activity (Roadmap f-ai-candidate-catalog, f-activity-ai-entries). A host that hands the seat a model now gets an AI section in the context menu on both faces: a few suggestions the model picked for what was right-clicked, "Fill in with AI" and "Draw a panel". The model never invents: `catalogOf(store, target, { principal })` on the new `@graview/core/catalog` derives, for a record, a selection, a field, a list or a lens, an act or a place, the candidates with an id and a line each — the acts the viewer may run there, the panels its kind can be drawn as, the places and records next to it, the values its fields may take — and `aiContextOf` the compact state a model reads beside them (where the viewer is, the target, the selection, the records one link away, what was done lately, a digest of the declaration cached per declaration), both under the viewer's sight: nothing they may not see or run is ever offered or said.

`HostAi` gains two provider slots: `fast`, a typed-decision model in Jev's shape (`{ model, decide }`; `jevFast()` fills it with Jev), and `thinking`, a language model (`{ model, think({ system, prompt, state, catalog }) }`); unsaid, `decide` and `complete` serve them. Every call reports its tier, model, tokens and cost to the interaction and to `ai.meter`. `@graview/tools/inline-ai` holds the engine (`suggestHere`, `fillHere`, `panelHere`), the ghost (`ghostOf`, `acceptGhost`) and stub providers (`stubFast`, `stubThinking`) for tests and a dev app; the todo example takes them at `?ai=stub`. A proposed change waits as a ghost with Accept, Accept some and Dismiss, is kept as one batch whose ops carry lineage `interaction` and come through `ai:<interaction>`, and is taken back with one undo; a panel is drawn where the seat draws a view, and "Keep as a lens" makes it a real one.

Each interaction is one entry in Activity (`AiInteraction`: who, when, the target, what was asked, offered and taken or dismissed, the batches it made with their undo, the models and their cost), and the change it made is drawn in it rather than again beside it. Activity filters All, Changes or AI and "Just mine"; a record's page lists what AI did there (`RecordInteractionsDoor`); an entry can ask again or show its panel again. A host keeps them with `ai.interactions` (`{ load, keep }`). `ai: { off: true }` hides every AI part on both faces — the menu's section, the ghost, the ask field, the entries and the filter — rather than disabling it.

It adds 1.3 KB more up front to a hosted page (1,305 bytes, 460 gzipped), and its raises are filed in `scripts/budget-raises/`.

Compatibility: ops and primitives: an op's `lineage` may carry `interaction`, the id of the AI interaction it came from; a reader that does not know it reads the lineage as before. New: `@graview/core/catalog`, `@graview/tools/inline-ai`, `HostAi.off`, `.fast`, `.thinking`, `.interactions` and `.meter`, `GraviewContextValue.aiDesk`, `GoTo.draft`, and `GhostDoor`, `InlineAiSections`, `useInlineAiSection` and `RecordInteractionsDoor` on `@graview/primitives`.
