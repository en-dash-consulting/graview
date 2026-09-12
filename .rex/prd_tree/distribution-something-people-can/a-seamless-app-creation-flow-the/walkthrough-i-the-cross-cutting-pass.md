---
id: "1c2ca394-c075-4ad8-a79d-49af57dceb2f"
level: "task"
title: "Walkthrough I · The cross-cutting pass"
status: "in_progress"
priority: "high"
tags:
  - "walkthrough"
  - "a11y"
startedAt: "2026-09-11T18:41:15.972Z"
resolutionType: "code-change"
resolutionDetail: "Stage I walked. The cross-cutting matrix ran against the walk app: keyboard-only (tab to the district, Enter, tab to the offer, Enter, type, Enter — a record added with no pointer), reduced motion on and off, text zoom at 200% (root font size, not page zoom), and widths 320, 390 and 1280 in both schemes — axe clean and no sideways scroll in every combination. The app also runs whole in WebKit and Firefox as well as Chromium: adds, travels to a lens, renders its own design and mounts two embeds with no console errors. A consolidated re-run of the stage A–H criteria holds 20 of 20 at 1280, 390 and 320 in both schemes. Two findings: W-030 the stage asked for a `?renderer=gpu` that does not exist for a scaffolded app — the playbook now asks for the three shipping engines and names every harness rather than four, with the instruction to run them at the end of every stage; W-031 every count in audit-ui ran at 1560 only, so the defect it was written to catch was invisible to it — a state may ask for its own window now and seedbed/narrow is 390x620 with a record travelled into, verified failing with the rail forced back to its wide placement. Final sweep, all green: pnpm test (648), typecheck, check, audit-ui 10/10, seat 6/6, shrunk, menu, navigation, pages, chat, remember 12/12, survey, site, progression, engines, smoke and smoke:create 30/30."
acceptanceCriteria:
  - "everything in stages A to H is still true under each condition"
  - "pnpm site, pnpm audit-ui, pnpm survey and pnpm progression pass with the criteria added during the walk"
  - "a second agent from a fresh checkout adds nothing to docs/walkthrough-findings.md"
description: "Stage I of docs/walkthrough.md: a keyboard-only pass of every stage, reduced motion on, the GPU renderer in Chromium, text zoom at 200%, a 320px window; then every framework harness with the criteria added along the way."
lastModified: "2026-09-12T13:30:34.778Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
