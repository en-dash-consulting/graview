---
id: "1c2ca394-c075-4ad8-a79d-49af57dceb2f"
level: "task"
title: "Walkthrough I · The cross-cutting pass"
status: "completed"
priority: "high"
tags:
  - "walkthrough"
  - "a11y"
startedAt: "2026-09-11T18:41:15.972Z"
completedAt: "2026-09-12T14:45:35.126Z"
endedAt: "2026-09-12T14:45:35.126Z"
resolutionType: "code-change"
resolutionDetail: "Third walk, stage I: a keyboard-only pass of every stage's work (select a district, add through the strip, add a second kind, take a repair that asks, undo from the rail, reach a place, cross to the routed face) driven in Chromium and Firefox to completion; reduced motion; WebKit and Firefox as well as Chromium; a 32px root font at 390 and 1280; a 320-wide window. Four findings, each fixed with a criterion verified failing first: W-066 the keyboard stranded in WebKit when the pane it was in goes away (packages/primitives + verify-engines keyboardSurvivesThePane, run per engine); W-067 every picker on the routed face under 24px in WebKit only (packages/pages/form + verify-pages bigEnoughToHit, plus `pnpm engines` added to the playbook's end-of-stage list); W-068 nothing anywhere rendering a page at a bigger root font (verify-pages readersOwnTextSize over four routes); W-069 the routed face scrolling two ways at 200% text in WebKit and Firefox, which W-068's criterion then found in the framework itself (packages/pages column, form and fields). Known platform behaviour reported rather than fixed: WebKit leaves links out of the Tab order by default, so the Pages link is reached by Option+Tab in Safari. Whole harness list green, including pnpm engines (every engine holds) and smoke:create."
acceptanceCriteria:
  - "everything in stages A to H is still true under each condition"
  - "pnpm site, pnpm audit-ui, pnpm survey and pnpm progression pass with the criteria added during the walk"
  - "a second agent from a fresh checkout adds nothing to docs/walkthrough-findings.md"
description: "Stage I of docs/walkthrough.md: a keyboard-only pass of every stage, reduced motion on, the GPU renderer in Chromium, text zoom at 200%, a 320px window; then every framework harness with the criteria added along the way."
lastModified: "2026-09-12T14:45:35.136Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
