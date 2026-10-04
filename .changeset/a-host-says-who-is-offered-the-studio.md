---
"@graview/studio": patch
"@graview/embed": patch
"@graview/core": patch
---

A host that keeps the declaration says who is offered the studio (FR-59). `maySeeTheStudio` judges by the app's own policy, which grants the app's people, not its builders: on the vendors app only an owner or a planner may do everything, so an editor Graview Cloud had already let onto its builder was shown no studio, and Cloud's way round it was to hand the embed a store with the policy taken off. Now `StudioPlace` takes `offered`, and the embed's `studio` option passes it through: `true` or `false` is the host's word over the policy's, and a function `(store, principal) => boolean` decides from the store and the seat. Omitted, `maySeeTheStudio` decides as it always has. The app's policy stays on the store for everything else the embed draws. A test opens the vendors app through `mount(…, { studio: { onApply, offered: true } })` as a seat whose only role is `viewer`: the studio is drawn, and `handle.store.policy` is still the app's; without `offered` the same seat is offered nothing; `offered: false` withholds it from an owner. `StudioOffered` is exported from both packages, and `capabilities().shipped` names FR-59.

Compatibility: the wire — additive: `capabilities().shipped` gains `FR-59`. `offered` is a new optional prop and option; omitted, who sees the studio is unchanged. Ops, stored formats, check codes and tool schemas are unchanged.
