---
id: "93105042-bd0b-46ed-8308-b1617a3295d9"
type: "change"
title: "The one face's GPU leg holds again"
slug: "f-one-face-gpu-leg-back-to-green"
intent: "From HQ feature:f-one-face-gpu-leg-back-to-green: pnpm verify:github one-face --renderer gpu on main 643575015 (run 44868606084) fails 24 claims; before 0.2.8 (8dbbee9c0, run 44833014540) it failed 11. Find what moved (the Chrome version first, per the Nightly Chrome pin), then fix the faults or pin. Also: the pan-after-pinch claim fails some runs at GRAVIEW_SLOW=12 (a thin margin at 4), and packages/react a-host-says-who-is-offered-the-studio.test.tsx fails on a cold run on main."
acceptanceCriteria:
  - "pnpm verify:github one-face --renderer gpu passes every claim on the branch head, or each claim still failing is named with its cause and a filed follow-up"
  - "What moved between run 44833014540 and run 44868606084 (browser version, code) is named in the PR"
  - "a-host-says-who-is-offered-the-studio.test.tsx passes on a cold run (test)"
  - "The pan-after-pinch claim passes three runs in a row at GRAVIEW_SLOW=4"
priority: "medium"
tags:
  - "graview"
  - "pages"
  - "harness"
  - "hq:feature:f-one-face-gpu-leg-back-to-green"
source: "Graview HQ feature:f-one-face-gpu-leg-back-to-green"
---
