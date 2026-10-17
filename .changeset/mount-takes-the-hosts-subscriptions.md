---
"@graview/embed": patch
"@graview/ship": patch
"@graview/skills": patch
"@graview/core": patch
---

`mount` takes the host's subscriptions, and a page that keeps them on a served store carries no rule parser (FR-182). `GraviewProvider` and the pages' context took `subscriptions`, but the embed's options had none, so on a hosted page the sheet "Notify me…" and Activity's list kept a reader's subscriptions in the page's memory. `subscriptions` (any `SubscriptionStore`) is now one of the embed's options, on `mount` from `@graview/embed` and from `@graview/embed/pages`, and on `<Embed>`, handed to the provider on both faces and to the pages' context. `remoteSubscriptions` moved out of the module that answers `/graview/subscriptions` into one of its own, so asking the route no longer brings the expression and template parsers, which the answer judges a subscription with, into a hosted page's first chunk: the compiled shell handing `mount` a `remoteSubscriptions` store was 10,360 bytes (10.1 KB) heavier up front than the shell without one, and is now 767 bytes heavier, 9.4 KB less; the page that compiles its document, which carries the parsers anyway, is 1.9 KB less. Both are still exported from `@graview/ship`, `@graview/ship/browser` and `@graview/ship/runtime` as they were. The embed's README and the graview-embed skill say the option. `capabilities().shipped` gains FR-182.

Compatibility: ops, stored formats, the declaration and derived tools are unchanged. The wire is unchanged: `/graview/subscriptions` answers as before, and `answerSubscriptions`, `remoteSubscriptions` and `SUBSCRIPTIONS_PATH` keep their entries; `capabilities().shipped` lists FR-182. What Graview Cloud does: pass `subscriptions: remoteSubscriptions({ url, principal })` to `mount` and drop its interim stand-in for the store.
