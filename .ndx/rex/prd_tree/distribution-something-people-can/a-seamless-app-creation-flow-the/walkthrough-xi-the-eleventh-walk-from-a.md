---
id: "a97971f3-d08d-4ac7-8459-cd374a416be8"
level: "task"
title: "Walkthrough XI · The eleventh walk, from a fresh checkout, adds nothing"
status: "failing"
priority: "critical"
tags:
  - "roadmap"
  - "walkthrough"
blockedBy:
  - "07a4132b-6c2c-4d30-a409-12a433596a49"
  - "96b54bdd-8bf4-494c-a946-ad0fd9463182"
  - "b9e64a2e-8fdf-489e-a3f6-2a8bdeeb5605"
  - "61161f4d-c45d-4b3e-801e-a133b5539d9f"
  - "e493f990-e60a-44ca-b399-d6f6dae7188f"
  - "b6ecaff4-09fc-40ca-9470-5b1677459493"
  - "610d8397-c4cd-427a-bdd4-43dddd8a79d8"
  - "9363b216-bad2-49e9-b2d4-598aa1a40c25"
  - "3fc72b36-85b5-4006-a7d9-d52d10e25700"
  - "2b16bb49-5218-4f2c-92ab-c8ad3ce5382c"
  - "5f0ea620-4187-472a-b44e-c366f50e998c"
source: "The tenth walk, 2026-10-15: thirteen findings and nine carried dead ends fixed, no new class, so the log did not stay still."
acceptanceCriteria:
  - "a fresh checkout, pnpm install && pnpm build && pnpm test, then graview create of a new app beside it"
  - "all nine stages walked by an agent that did not do the previous walks"
  - "docs/walkthrough-findings.md gains nothing; if it does, the fixes land with criteria and the walk repeats"
description: "The tenth walk (task 07a4132b, a mountain rescue team) added W-204 to W-225, all fixed in 0.1.30. This is the next run: a fresh checkout, a new app beside it with graview create (../walk11, in a domain of its own, seeded at real size through its own acts), all nine stages of docs/walkthrough.md by an agent that did not do the previous walks, and every finding fixed in a package with a criterion verified to fail without it. Walk 0.1.30's new surfaces too: playback, a relation to another app, the tidying tray, the first look, the right-click menu on pages, navigate with filters, and graview.dev's start.md as an agent would follow it. Since 0.1.31 and 0.1.34 (Roadmap f-walk-xi): the quick ask (Cmd+K), the right-click AI and its ghost, Notify me, the date editor, a declared connection, GPU drawing with blur, the Releases page, and the 0.1.34 menu (a visitor told how to get in, a panel drawn on Pages, suggestions on request, prefetched menus). Carried open: the twelve collisions the watch's control-covered rule acknowledged (W-224, the Roadmap's f-watch-collisions-w224); fix them or show each is not a collision. Run the browser harnesses one at a time on a port block no other checkout holds; a walker that adds or widens a watch rule runs the harnesses it touches without --quick."
lastModified: "2026-10-18T04:30:00.000Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---

## Notes

Walked 2026-10-17 on walk/xi from feat/0-1-34-additions (88ad1ec6): an animal shelter at ../walk11 (84 kennels, 1,400 adopters, 3,076 animals, 5,900 links, seeded through its own acts in 18 s). The log gained six findings, W-226 to W-231, each fixed in a package with a criterion verified failing without it; no new class. The journeys on walk11 went from 72 of 88 runs (Find and narrowing on the scene blocked every way) to 84 of 84 run. Full `pnpm test`: 872 files, 6,556 passed, 1 skipped. With `--quick`: menu, inline-ai, notify, quick-ask, date-inputs, app-links, kind-stop, pages, gauntlet, declared and hosted hold; playback fails scrubbingFromTheStartShowsTheAppGrow and everyStopShowsTheAppExactlyAsItWas with or without this walk's changes. W-224's collisions: the watch's acknowledged list is empty since 0.1.31. Failing, not completed: the log did not stay still, and docs/walkthrough-findings.md carries what is open (playback, the gauntlet lacking a field of one name on two kinds, the watch not hearing input refusals, the keyboard's 25 Tabs into a long list, the scaffold's record page drawing fields as text, the 41-press relate from the keyboard, `--link` under npm). The reviewer runs the full chain.
