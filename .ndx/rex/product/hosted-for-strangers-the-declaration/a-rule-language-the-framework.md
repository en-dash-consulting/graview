---
id: "3b647ea3-7070-40ee-b351-5115f42c5d3f"
type: "capability"
title: "A rule language the framework interprets: total, budgeted, and read like a sentence"
slug: "a-rule-language-the-framework"
statement: "Graview interprets a small, total expression language, with a step and node-visit budget per evaluation, so a rule can be declared and read like a sentence without writing code."
criteria: [{"id":"c1","text":"When an expression is evaluated, the rule language shall support literals, field access, one-edge hops, out/in/all sets with where, and a closed set of functions (count, exists, every, some, sum, min, max, present, len, contains, startsWith, lower, today, now, days, hours, date, if)."},{"id":"c2","text":"When an expression reads a null value, the rule language shall propagate null through the expression."},{"id":"c3","text":"The rule language shall provide no regular expressions, no loops and no user-defined functions."},{"id":"c4","text":"The rule evaluator shall limit each evaluation by a step budget and a node-visit budget."},{"id":"c5","text":"If an evaluation exceeds its budget, the rule evaluator shall yield a rule-too-costly violation naming the rule rather than hang."},{"id":"c6","text":"The rule language shall serve invariant require/when, act allowedWhen, computed values and view conditions."},{"id":"c7","text":"When a per-subject rule iterates all('kind'), graview check shall warn."},{"id":"c8","text":"The studio shall expose a rule's judgement as an editable field, so an agent in the studio can propose one."},{"id":"c9","text":"When a studio rule has a judgement written in the language, the studio shall evaluate it after the change is applied."}]
tags:
  - "graview-cloud"
  - "FR-07"
source: "Graview Cloud FR-07, 2026-10-02"
priority: "critical"
---

WHAT IS THERE NOW: an invariant's judgement is a function; a studio-declared rule gets evaluate: () => [] and 'the checkout gives it a judgement'. MISSING: a way to say what must hold without writing code. POSITION: a small expression language (grammar at ../graview-cloud/docs/declaration-document.md#expression-language): literals, field access, one-edge hops, out/in/all sets with where, a closed function set (count, exists, every, some, sum, min, max, present, len, contains, startsWith, lower, today, now, days, hours, date, if), null propagation, no regex, no loops, no user functions; a step and node-visit budget per evaluation. Used for invariant require/when, act allowedWhen, computed values, and FR-03 view conditions. The studio gains a rule's judgement as a field it can edit, so an agent in the studio can propose one.
