---
id: "4ef9f01c-fb75-4091-9e17-5d1e4a73816c"
level: "feature"
title: "The pointer menu leads with the thing you clicked: its own repair first, then its acts, then the rest"
status: "pending"
priority: "critical"
tags:
  - "menu"
  - "strip"
  - "repairs"
  - "affordances"
  - "workbench"
  - "tools"
source: "Nick, 2026-09-13: \"/ndx-capture ensure that contextual menus surface the action for the item Clicked at the very top, right now it can be buried under other problem resolution items.. but i want to resolve that item's problem when i click it\""
acceptanceCriteria:
  - "right-clicking a node implicated in a problem offers that problem's repair as the first entry, ahead of any other problem's repair; with two problems open in the todo example this holds for the task implicated in each"
  - "after the clicked node's repairs come its own acts, one-press acts before asks; then the rest of the selection's; withheld acts last, shown with the policy's sentence"
  - "the actions strip, the pointer menu and the record page's act list share one rank from the derivation and never disagree about what comes first"
  - "verify-menu drives the two-problem case from the scene, the pages record and the problems inbox, and audit-ui's menu state asserts the first entry names the clicked thing"
description: "Right-clicking a flagged item should offer, first, the repair for that item's own problem. Today the menu is built from the selection's affordances and the current violations in the order the derivation returns them, so when several problems are open the repairs for other items' problems — the same rule's other subjects, or another rule's — come first, and the act for the thing under the pointer is buried below them. The menu (and the actions strip's ordering, which is the same list) needs an order that follows the press: the repairs whose subject or implicated nodes include the clicked node first, in the order the rule lists them; then the clicked node's own acts, with the ones the derivation settled to one press ahead of the ones that ask; then repairs and acts for the rest of the selection; withheld acts last, still shown and still saying why. One rule for both surfaces, in packages/tools' derivation (a rank the strip and the menu both read), so they never disagree about what comes first. A criterion drives it: with two problems open in the todo example, right-click the task implicated in the second and assert the first entry is that task's repair; do the same from the pages record and the problems inbox. Source: Nick, 2026-09-13: \"ensure that contextual menus surface the action for the item Clicked at the very top, right now it can be buried under other problem resolution items.. but i want to resolve that item's problem when i click it\"."
lastModified: "2026-09-13T05:07:14.401Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
