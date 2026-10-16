---
id: "b6ecaff4-09fc-40ca-9470-5b1677459493"
level: "task"
title: "0.1.31 · 07: Notify me when X happens: subscriptions declared, matched under sight, offered in place"
status: "completed"
completedAt: "2026-10-16T16:10:00.000Z"
startedAt: "2026-10-16T14:53:47.000Z"
priority: "high"
tags:
  - "roadmap"
  - "graview-cloud"
  - "0.1.31"
source: "ndx-capture"
acceptanceCriteria:
  - "from a right-click on a record, a kind or an act a person subscribes in two presses or fewer"
  - "a matching change from someone else fires onSubscriptionMatch once with what changed, and a change to a record the subscriber cannot see never fires it"
  - "a test covers each trigger type, and a chat tool call creates a subscription"
description: "Roadmap f-notify-subscriptions, the framework half of 'Notify me every time X happens in this app' (Nick, 2026-10-15); delivery is Cloud's f-act-notifications-config. A subscription shape in core: { who, app, when }, where when is an act running (optionally named, optionally on one record), a record of a kind created, a record of a kind (or one record) changed, or a field reaching a value (a condition in the app's expression language), with 'only when someone else did it' on by default. A matcher on the op log judges each committed batch under the subscriber's sight and calls a host hook onSubscriptionMatch. 'Notify me' offered on the right-click menu (Scene and Pages) for a record, a kind's list or an act, on a record page and after an act's form, each opening a one-step prefilled sheet; named edits/tools so a chat can subscribe; a person's subscriptions listed in one place with one-press unsubscribe."
lastModified: "2026-10-16T16:10:00.000Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---

## Notes

### 2026-10-16

Built:

- **The shape** (`packages/core/src/subscription-shape.ts`, on the main entry because a page holds it before it judges anything): `Subscription { id, who: Principal, app, when, alsoMine?, at }`, `SubscriptionWhen` = `{ on: "act", act?, record? }` | `{ on: "created", kind }` | `{ on: "changed", kind? | record? }` | `{ on: "reaches", kind, condition, record? }` (condition in the rule language, parsed and evaluated with `parseExpr`/`evaluateExpr` over `shapesOfSchema`), `SubscriptionMatch`, `MatchedRecord`, `OnSubscriptionMatch`, `SubscriptionStore { list(whoId?), add(draft), remove(id), onChange? }`, `memorySubscriptions()`, `subscriberOf(principal)` (the person an agent acts for). "Only when someone else did it" is the default; `alsoMine: true` opts in.
- **The matcher** on a new entry, `@graview/core/subscriptions` (package exports, AGENTS.md, the main-entry test): `matchSubscriptions(store, ops, subs, { app? })` groups a commit's ops by batch and reads each batch through the subscriber's lens (`seatLens` + `redact`), so a change to a record they cannot see never matches, a field kept from them is not said nor read by a condition, and a withheld op says "Someone". At most one match per batch per subscription. `reaches` fires on the batch that made the condition true (false before, true after; each record is rebuilt as it stood just after the batch, so an async store list is still judged right). `watchSubscriptions`, `subscriptionWords`, `subscriptionProblem`.
- **Storage, decided**: a host seam, never the graph (not in the log, not undone, not exported, not seen by others). The provider takes `subscriptions` (else the page's own memory); ship's handler takes `subscriptions` (else memory) and `onSubscriptionMatch`, matching in its commit listener, and serves `/graview/subscriptions` (GET own; POST `{ add: { when, alsoMine? } }` / `{ remove }`), added to WIRE and the README. `graview serve` keeps them in `<data>/<app>/subscriptions.json` (`fileSubscriptions`, re-read on mtime so `graview mcp` on the same store shares it) and prints each match. `remoteSubscriptions` is the page's half.
- **Tools**: `subscribe`, `unsubscribe`, `list_subscriptions` listed when `ToolRuntimeOptions.subscriptions` is given (chat, agent seat, `createMcpHttpHandler`, `graview mcp`), always for the person (`subscriber`, else `onBehalfOf`), judged as they see the app; definitions static, the runner lazy.
- **UI**: "Notify me…" section on the context menu of both faces (`NotifySections`/`useNotifySection`) for a record, a kind card or list ground, and an act (`MenuTarget.act`/`PointerMenu.act`, from `data-graview-act` on the record page's and list's act buttons); a record page "Notify me when this changes"; "Notify me when someone else does this" after an act's form (framework page and todo's own design); a one-step sheet (`<dialog>`, prefilled, first button keeps it); Activity lists "You are told" with one-press Stop. Sheet and list are a lazy chunk.
- **Tests**: core (every trigger, sight, field sight, own changes, agent-for-person, words/problems, watch), ship (hook once, hidden record never, wire route, file store), tools (chat tool creates a subscription the matcher tells). **Harness** `pnpm verify notify` (docs/notify.json), 6 claims, passing in chromium, webkit and firefox, watch clean; menu, inline-ai and pages still hold. Budgets raised by files (0.8 KB up front on a hosted page); before-draw literal 926 KB. graview-sight skill has a paragraph.

Left: Cloud's delivery (f-act-notifications-config) and a host-side digest/throttle; the "reaches" condition reads relations as they stand now, not as of the batch.
