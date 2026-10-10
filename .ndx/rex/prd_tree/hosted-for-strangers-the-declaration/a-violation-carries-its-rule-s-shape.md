---
id: "7566fb34-e85a-4179-bbaf-7eb7e13ccaa0"
level: "feature"
title: "A violation carries its rule's shape wherever it is read (FR-159)"
status: "pending"
priority: "high"
tags:
  - "graview-cloud"
  - "FR-159"
  - "invariants"
  - "lines"
source: "Graview Cloud, 2026-10-10 (the framework brief after 0.1.20, ../graview-cloud/docs/framework-brief-0.1.21.md)"
acceptanceCriteria:
  - "A violation the engine reports carries line when the rule's shape is known, without the hosted page's first load growing"
  - "A violation's message reads with its values when the title is short"
  - "The release notes name what a host with its own problems surface does"
description: "Violation.line was not set by the engine; a host's own problems surface (Cloud's connector get_problems, AppRoom.problems) had to call withLines from @graview/core/lines, so since 0.1.20 a chat reads 'A wedding planner on Small: Margin above target' with no values."
lastModified: "2026-10-10T16:00:00.000Z"
---
