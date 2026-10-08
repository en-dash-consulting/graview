---
"@graview/core": patch
"@graview/react": patch
"@graview/primitives": patch
---

No module of core, react or primitives imports itself back at run time. `ndx analyze .` after 0.1.17 found 35 import cycles; six of them ran when the module loaded and the rest closed through a type. The ones that ran: the chat and the inspector imported the companion that holds them for `useSubject`, which is its own module now (`subject.ts`); the figure and the connections list took `hueFor` back from the default views, which only passed on `@graview/render`'s; the calendar's spans took `longDay` from its drawing, which is a date in words and lives with the dates; and the motion hook read the context that creates its store, which is its own module (`motion-store.ts`). Of the cycles through a type, the ones a single move ended went too: `SceneNode` has its own module, so the scene's six helpers no longer name the scene root; `ViewMode` is the view registry's, the calendar's `Emphasis` its drawing's, the refusal reasons `refused.ts`'s ("its own module, importing nothing" is true again), a sync conflict the sync types', and the document's expressions, blocks and templates import the graph's types from `graph/types.ts` rather than core's whole barrel. Every name is exported where it was.

Compatibility: internal; no public name, export, behavior or format changes.
