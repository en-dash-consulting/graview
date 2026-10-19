---
"@graview/core": patch
"@graview/react": patch
"@graview/primitives": patch
"@graview/pages": patch
"@graview/ship": patch
"graview": patch
---

The first load asks for nothing it does not draw again. The place menu's tidying had put a round trip and six requests in front of the first paint: the preview's page asked `/graview/views` only after the document came, and waited for the answer before it drew; the frame fetched what tidies the registry though nothing was hidden; and the routed face's first chunks carried what a press on Hide or Delete does, the drop-down's foot and the gesture's reading, while the bar's panes carried the hover chips' switch. Now `graview preview` hands the views with the document, as it hands the store's state, and `remoteViews` starts from them (`state`) without asking; `useTidiedViews` fetches `tidyViews` the first time the host lists something hidden or deleted; the menu's rows decide what they offer as the menu opens and fetch what a press does while the pointer rests on them; the foot is fetched when the drop-down opens with something to list, the gesture's reading with the bar's panes; and the person's menu fetches the hover chips' switch only where the host offers chips. On a slow phone the roadmap is useful in 3.5 s where it took 4.1 and interactive in 5.3 s where it took 5.9, on 75 requests where it took 80, as main measured it before the batch; the tasks are useful in 3.4 s where they took 4.1.

`tidyViews` is no longer on `@graview/react`'s main entry, which put it in every chunk that imports that entry: a host hands `keptViews` and `useTidiedViews` does the rest. The rule for whether a viewer may tidy a place is `placeTidying` on `@graview/core` (it was `tidyingOf` on `@graview/primitives`, a name core's suggestions already use), and `PLACE_MENU_EVENT` is on `@graview/react/provider` beside the menu it opens, still re-exported by `@graview/primitives`; `useKeptViews` is gone from `@graview/primitives`. The routed face alone loads 5.4 KB (2.0 KB gzipped) less before it draws; up front, a hosted page carries 0.3 KB more for the frame following the host's views itself, and the place menu's raises are measured again.

Compatibility: the preview's `/graview/document` carries `views`, the answer `/graview/views` gives its seat; `remoteViews` takes an optional `state`. Ops, stored records, the declaration and derived tools are unchanged.
