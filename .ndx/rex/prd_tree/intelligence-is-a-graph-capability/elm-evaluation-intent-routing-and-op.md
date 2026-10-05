---
id: "ba7345a2-a4fc-4a91-8487-8f03b738f84c"
level: "task"
title: "ELM evaluation: intent routing and op-log-learned ranking, measured"
status: "completed"
priority: "low"
source: "Split from \"Local intelligence\" (c1d797e0) Track B — the generative ladder shipped first; a classifier evaluation deserves real data, not a synthetic verdict."
startedAt: "2026-09-01T13:26:34.376Z"
completedAt: "2026-09-01T13:29:34.322Z"
endedAt: "2026-09-01T13:29:34.322Z"
resolutionType: "code-change"
resolutionDetail: "Measured verdict: NO-LIFT — dropped. Reproducible benchmark (scripts/eval-elm.mjs → docs/elm-eval.json): template-held-out intent routing across all four apps' declared vocabularies, 3 seeds, pre-registered thresholds. Derived word-matching 0.644 overall vs ELM 0.235 (0.324 tuned at 384 hidden units). ELM collapses on exact-title phrasings (≤0.14 vs baseline 1.0 — cannot pick among 10–20 mutation intents) but wins on partial phrasings (0.46–0.69 vs 0.07–0.18) — a hybrid fallback noted for post-launch revisit with real phrasings. Ranking slot DEFERRED: learning from applied suggestions needs real op logs that predate no launch."
acceptanceCriteria: []
description: "Evaluate AsterMind-ELM (in-browser Extreme Learning Machine — trains in ms, predicts in µs, small JSON models) for two non-generative slots: (1) chat intent routing trained on the app's declared vocabulary (mutation titles, kind plurals, edge descriptions) versus graphResponder's current word matching; (2) per-workspace affordance ranking learned from which op-log suggestions actually get applied, feeding the existing score field. Build a small phrasing corpus per example app for (1); use recorded op logs for (2). Ship a measured verdict: adopt behind the Responder/provider seams, or record no-lift and drop. Both slots are internal upgrades — no new surface, no new trust."
---
