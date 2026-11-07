---
id: "7566fb34-e85a-4179-bbaf-7eb7e13ccaa0"
type: "capability"
title: "A violation carries its rule's shape wherever it is read (FR-159)"
slug: "a-violation-carries-its-rule-s-shape"
statement: "A violation the engine reports carries its rule's shape, so a host's problems surface reads it with its values without calling withLines."
criteria: [{"id":"c1","text":"When the rule's shape is known, the engine shall set line on each violation it reports, without growing the hosted page's first load."},{"id":"c2","text":"When a violation's title is short, the engine shall write its message with the violation's values."}]
tags:
  - "graview-cloud"
  - "FR-159"
  - "invariants"
  - "lines"
source: "Graview Cloud, 2026-10-10 (the framework brief after 0.1.20, ../graview-cloud/docs/framework-brief-0.1.21.md)"
priority: "high"
resolution: "Fixed in #192: once @graview/core/lines is loaded the engine gives every judgment its line (a 68-byte hook, no budget raised), a rule with no says says its values in its message after its title, and the store handler and a seat's tools load the words."
---

Violation.line was not set by the engine; a host's own problems surface (Cloud's connector get_problems, AppRoom.problems) had to call withLines from @graview/core/lines, so since 0.1.20 a chat reads 'A wedding planner on Small: Margin above target' with no values.
