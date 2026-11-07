---
id: "4ef9f01c-fb75-4091-9e17-5d1e4a73816c"
type: "capability"
title: "The pointer menu leads with the thing you clicked: its own repair first, then its acts, then the rest"
slug: "the-pointer-menu-leads-with-the-thing"
statement: "Right-clicking an item in the pointer menu offers the repair for that item's own problem first, then its own acts, then the rest of the selection's, with withheld acts last."
criteria: [{"id":"c1","text":"When a person right-clicks a node implicated in a problem, the pointer menu shall offer that problem's repair as the first entry, ahead of any other problem's repair, including when two problems are open in the todo example."},{"id":"c2","text":"After the clicked node's repairs, the pointer menu shall list the clicked node's own acts with one-press acts before acts that ask, then the rest of the selection's repairs and acts, and then withheld acts last, each shown with the policy's sentence."},{"id":"c3","text":"The actions strip, the pointer menu and the record page's act list shall read one rank from the derivation so that they agree about what comes first."}]
tags:
  - "menu"
  - "strip"
  - "repairs"
  - "affordances"
  - "workbench"
  - "tools"
source: "Nick, 2026-09-13: \"/ndx-capture ensure that contextual menus surface the action for the item Clicked at the very top, right now it can be buried under other problem resolution items.. but i want to resolve that item's problem when i click it\""
priority: "critical"
---

Right-clicking a flagged item should offer, first, the repair for that item's own problem. Today the menu is built from the selection's affordances and the current violations in the order the derivation returns them, so when several problems are open the repairs for other items' problems — the same rule's other subjects, or another rule's — come first, and the act for the thing under the pointer is buried below them. The menu (and the actions strip's ordering, which is the same list) needs an order that follows the press: the repairs whose subject or implicated nodes include the clicked node first, in the order the rule lists them; then the clicked node's own acts, with the ones the derivation settled to one press ahead of the ones that ask; then repairs and acts for the rest of the selection; withheld acts last, still shown and still saying why. One rule for both surfaces, in packages/tools' derivation (a rank the strip and the menu both read), so they never disagree about what comes first. A criterion drives it: with two problems open in the todo example, right-click the task implicated in the second and assert the first entry is that task's repair; do the same from the pages record and the problems inbox. Source: Nick, 2026-09-13: "ensure that contextual menus surface the action for the item Clicked at the very top, right now it can be buried under other problem resolution items.. but i want to resolve that item's problem when i click it".
