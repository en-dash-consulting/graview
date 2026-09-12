---
id: "b5033e4d-d028-4c2a-992f-3bb618a12908"
level: "task"
title: "Walkthrough F · Who may do what"
status: "in_progress"
priority: "critical"
tags:
  - "walkthrough"
  - "permissions"
startedAt: "2026-09-11T17:49:23.058Z"
resolutionType: "code-change"
resolutionDetail: "Stage F walked: two roles declared in src/domain/policy.ts (keeper, hand) per graview-permissions, handed to defineApp and the Store, with a principal threaded through the app (?seat=) and a seat for each on the embed at /embed.html. Five findings fixed with criteria: W-019 a withheld act did not say why — the reason was a title on a disabled button, Grant.describe was documented and unread, and a derived edit's refusal said \"no role can\" against a `*` grant (core + primitives); W-020 a repair the seat may not take was offered live and refused on submit, in both pages surfaces and the scaffold template (pages + core); W-021 a project could not follow the embed rung of its own pages skill — no dependency, no alias, and EmbedOptions.views would not accept an app's typed registry (embed + core); W-022 nothing asserted a seat change keeps the store and its history (seedbed embed test); W-023 a seat the policy refuses wore its idle label with the reason in a title (primitives). Verified: the hand loses \"Hand it to somebody\" and \"Add an owner\" in the strip, the design and the pages, each struck through with \"Not permitted: … — keeper can. The keeper runs the walk.\"; nothing hidden and nothing refuses on press on any surface; the agent seat's tool list is 15 for the keeper and 10 for the hand, and a call outside it is refused with the same sentence; changing seats on either embed narrows both faces and leaves the store, its graph and its log untouched. axe clean on the record, the activity popover and the design's problems page for both seats at 1280 and 390 in both schemes."
acceptanceCriteria:
  - "with the narrower seat, every act it may not take is struck through with the policy's reason in the strip, the pages and the design; nothing hidden, nothing refusing on press"
  - "the agent's tool list is exactly the narrower seat's acts; a call outside it is refused with the same sentence"
  - "changing seats on the embed keeps the store and its history"
description: "Stage F of docs/walkthrough.md: following graview-permissions and graview-agent-seat, declare two roles and put a seat for each on the embed."
lastModified: "2026-09-12T11:55:21.010Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
