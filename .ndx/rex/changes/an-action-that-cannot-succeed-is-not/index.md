---
id: "ea8c2cf3-9a30-42fb-a406-eaa0dc637b91"
type: "change"
title: "An action that cannot succeed is not offered, and one that refuses says so"
slug: "an-action-that-cannot-succeed-is-not"
intent: "Two stacked faults made agreement editing read as broken. \"Adjust agreement\" takes a whole constraint spec — a union of typed objects — so the derived prompt was a free-text box whose every answer failed validation; and the failure vanished into the console, so the strip read as a button that does nothing. Fixed at both layers: the schema affordance provider skips un-askable actions; the Inspector catches apply/preview errors and prints the refusal (data-testid=refused) beside the prompt, keeping the prompt open for correction; the household example gained set-hour-cap and set-balance-tolerance with typed scalar args (also better agent tools), the weekly-hour-cap repair now asks for maxHours, and ConstraintView renders the spec's terms in the household's words."
acceptanceCriteria:
  - "The strip never offers an action whose open arguments it cannot honestly prompt for (a structured object with no candidates); such mutations remain available to agents and programmatic callers"
  - "A mutation that throws surfaces its message in the strip beside the prompt, and a rejected answer can be corrected in place rather than retyped blind"
  - "The household example's agreement parameters are editable through scalar prompts (hours cap, balance tolerance) and the hour-cap invariant repair asks for the number it needs"
  - "An agreement card states its own terms so an edit is visible where it was made"
  - "pnpm test, the affordances integration tests and pnpm direct stay green"
touches:
  - "2b687f3c-6253-4b93-86cf-0e592ae9fcdf"
priority: "high"
tags:
  - "bug"
  - "workbench"
  - "editing"
source: "Nick, 2026-08-31: \"not sure how to edit all the details of things.. like the Agreements in the household example it's not clear, and it doesn't seem like putting anything in the Adjust Agreement area does anything\""
---
