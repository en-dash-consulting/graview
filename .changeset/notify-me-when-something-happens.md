---
"@graview/core": patch
"@graview/ship": patch
"@graview/tools": patch
"@graview/react": patch
"@graview/primitives": patch
"@graview/pages": patch
"@graview/embed": patch
"@graview/skills": patch
---

A person can ask to be told when something happens in an app, and the host is told when it does (Roadmap f-notify-subscriptions). A subscription is `{ who, app, when }`, where `when` is an act running (any, one by name, and/or one on a record), a record of a kind added, a kind's records or one record changed, or a record reaching a condition written in the app's own rule language (`done == true`, `amount > 100`); it is told only of changes somebody else made unless it says `alsoMine`. `matchSubscriptions(store, ops, subscriptions)` on the new `@graview/core/subscriptions` judges a commit batch by batch as each subscriber's seat sees it — a change to a record they cannot see never matches, a field kept from them is neither said nor read by a condition, a change withheld from them is said as "Someone" — and answers at most one `SubscriptionMatch` per batch per subscription, with who made it, its sentence, the acts it ran and each record it touched with the fields it changed. `watchSubscriptions(store, { subscriptions, onSubscriptionMatch })` calls a host's hook on every commit; `subscriptionWords` says a subscription in words and `subscriptionProblem` says why one could never be told anything. The shapes and `memorySubscriptions()` are on the main entry.

`@graview/ship`'s handler keeps them (`subscriptions`, a `SubscriptionStore` of the host's; in memory when unsaid), serves each seat its own at `/graview/subscriptions`, and calls `onSubscriptionMatch` once per matching batch; `remoteSubscriptions` is the page's half, `fileSubscriptions` the file `graview serve` keeps beside the store and prints each match from. A chat subscribes its person with three new tools, `subscribe`, `unsubscribe` and `list_subscriptions`, listed where the host keeps subscriptions (`ToolRuntimeOptions.subscriptions`, `createMcpHttpHandler`'s, and always under `graview mcp`, which shares the file with `graview serve`).

On both faces the context menu offers "Notify me…" on a record, a kind's list and an act (a menu target now says the `act` it was opened on), a record's page offers "Notify me when this changes", and an act's form when it is done offers "Notify me when someone else does this": each opens one sheet already filled in, so from a right-click a person subscribes in two presses. What a person is told of is listed in Activity, each with one press to stop. The provider keeps them where its host says (`subscriptions`), else in the page.

It adds 0.8 KB more up front to a hosted page (864 bytes, 330 gzipped), and its raises are filed in `scripts/budget-raises/`.

Compatibility: the wire: a new route, `/graview/subscriptions` (GET the seat's own; POST `{ add: { when, alsoMine? } }` or `{ remove: id }`), and `createStoreHandler` takes `subscriptions` and `onSubscriptionMatch`; every other route answers as before. Derived tool names and input schemas: unchanged for a runtime given no `subscriptions`; given one, `subscribe`, `unsubscribe` and `list_subscriptions` are listed beside the read tools, and an act named any of them is listed as `<name>_2`. New: `@graview/core/subscriptions`, `Subscription`, `SubscriptionWhen`, `SubscriptionMatch`, `SubscriptionStore`, `OnSubscriptionMatch`, `memorySubscriptions` and `subscriberOf` on `@graview/core`, `MenuTarget.act`, `PointerMenu.act`, `GraviewContextValue.subscriptions`, and `NotifySections`, `NotifyDoor`, `NotifyButton`, `NotifiedDoor`, `useNotifySection`, `useNotifiedCount` and `askToNotify` on `@graview/primitives`.
