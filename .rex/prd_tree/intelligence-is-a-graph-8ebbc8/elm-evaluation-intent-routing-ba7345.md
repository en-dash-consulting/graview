---
id: "ba7345a2-a4fc-4a91-8487-8f03b738f84c"
level: "task"
title: "ELM evaluation: intent routing and op-log-learned ranking, measured"
status: "pending"
priority: "low"
source: "Split from \"Local intelligence\" (c1d797e0) Track B — the generative ladder shipped first; a classifier evaluation deserves real data, not a synthetic verdict."
acceptanceCriteria: []
description: "Evaluate AsterMind-ELM (in-browser Extreme Learning Machine — trains in ms, predicts in µs, small JSON models) for two non-generative slots: (1) chat intent routing trained on the app's declared vocabulary (mutation titles, kind plurals, edge descriptions) versus graphResponder's current word matching; (2) per-workspace affordance ranking learned from which op-log suggestions actually get applied, feeding the existing score field. Build a small phrasing corpus per example app for (1); use recorded op logs for (2). Ship a measured verdict: adopt behind the Responder/provider seams, or record no-lift and drop. Both slots are internal upgrades — no new surface, no new trust."
---
