---
id: "4364e70e-3188-40a2-a601-da94a85fafc2"
type: "change"
title: "The menu's first frames: Escape returns the keyboard, and Jev is asked at the press"
slug: "f-menu-first-frames-follow-ups"
intent: "From HQ feature:f-menu-first-frames-follow-ups (left by PR #693): (1) Escape pressed in the menu's first frames leaves the keyboard on <body> (keyboard-lands-nowhere on [data-testid=menu-type]); inline-ai's p95 loop waits 300 ms to step around it: fix it and drop the wait. (2) The Suggested rows' Fast call starts as the menu renders, not at the press: work out the candidates at the press. (3) Typing re-reports picks as a new showing; the Fast-only card promises Find on a page with none; the first look's N of M counts one too many with no record drawn; add tests for the held row height and the hover chip's outcome."
acceptanceCriteria:
  - "Escape in the menu's first frame returns the keyboard where it was, and inline-ai's 300 ms wait is gone (harness claim)"
  - "The Fast call for the Suggested rows starts at the press (test)"
  - "Typing does not re-report a pick already shown; Find is offered only where the page has one; the first look counts right (tests)"
  - "The held row height and the hover chip's outcome are tested"
priority: "medium"
tags:
  - "graview"
  - "primitives"
  - "tools"
  - "hq:feature:f-menu-first-frames-follow-ups"
source: "Graview HQ feature:f-menu-first-frames-follow-ups"
---
