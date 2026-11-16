---
id: "d60c8eb3-5bb9-41c9-a362-80702bf01a41"
type: "change"
title: "The timeline's scrubber is a target a finger can hit, and Back to now leaves the keyboard where the timeline was opened"
slug: "f-playback-watch-problems"
intent: "verify-playback's watch keeps two problems open: the scrubber's target is too small at 1440 wide, and pressing Back to now leaves the keyboard on body. Fix both in the component, and confirm with pnpm verify:github playback."
acceptanceCriteria:
  - "After Back to now the keyboard is on what opened the timeline, or the app menu's button, on both faces (test: back-to-now-leaves-the-keyboard-where-the-timeline-was-opened)"
  - "The scrubber is 24 pixels tall (test)"
  - "verify-playback's watch says neither problem (harness: pnpm verify:github playback)"
touches:
  - "3af8bf93-4b41-4e9d-b00c-f0cf1e631548"
priority: "medium"
tags:
  - "graview"
  - "primitives"
  - "playback"
  - "hq:feature:f-playback-watch-problems"
source: "Graview HQ feature:f-playback-watch-problems"
---
