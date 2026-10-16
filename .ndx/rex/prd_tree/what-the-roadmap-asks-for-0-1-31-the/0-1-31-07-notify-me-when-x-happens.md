---
id: "b6ecaff4-09fc-40ca-9470-5b1677459493"
level: "task"
title: "0.1.31 · 07: Notify me when X happens: subscriptions declared, matched under sight, offered in place"
status: "pending"
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
lastModified: "2026-10-16T04:36:21.479Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
