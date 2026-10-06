---
id: "ea8c2cf3-9a30-42fb-a406-eaa0dc637b91"
level: "task"
title: "An action that cannot succeed is not offered, and one that refuses says so"
status: "completed"
priority: "high"
tags:
  - "bug"
  - "workbench"
  - "editing"
source: "Nick, 2026-08-31: \"not sure how to edit all the details of things.. like the Agreements in the household example it's not clear, and it doesn't seem like putting anything in the Adjust Agreement area does anything\""
startedAt: "2026-09-01T02:49:04.654Z"
completedAt: "2026-09-01T02:49:04.654Z"
endedAt: "2026-09-01T02:49:04.654Z"
resolutionType: "code-change"
resolutionDetail: "Shipped in commit \"Districts stand on solid faces, a refusal says its sentence, and an agreement shows its terms\". Verified end to end in the browser: capping at 30 updates the violation text and the activity log with undo; pressing the cap action on a non-cap agreement prints its refusal in the strip. All harnesses green."
acceptanceCriteria:
  - "The strip never offers an action whose open arguments it cannot honestly prompt for (a structured object with no candidates); such mutations remain available to agents and programmatic callers"
  - "A mutation that throws surfaces its message in the strip beside the prompt, and a rejected answer can be corrected in place rather than retyped blind"
  - "The household example's agreement parameters are editable through scalar prompts (hours cap, balance tolerance) and the hour-cap invariant repair asks for the number it needs"
  - "An agreement card states its own terms so an edit is visible where it was made"
  - "pnpm test, the affordances integration tests and pnpm direct stay green"
description: "Two stacked faults made agreement editing read as broken. \"Adjust agreement\" takes a whole constraint spec — a union of typed objects — so the derived prompt was a free-text box whose every answer failed validation; and the failure vanished into the console, so the strip read as a button that does nothing. Fixed at both layers: the schema affordance provider skips un-askable actions; the Inspector catches apply/preview errors and prints the refusal (data-testid=refused) beside the prompt, keeping the prompt open for correction; the household example gained set-hour-cap and set-balance-tolerance with typed scalar args (also better agent tools), the weekly-hour-cap repair now asks for maxHours, and ConstraintView renders the spec's terms in the household's words."
---
