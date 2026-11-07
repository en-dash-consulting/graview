---
id: "dd64c586-6570-426d-ab55-845e913a11ab"
type: "change"
title: "0.1.38 · Inline AI, the framework's last part: a selection bar, one quiet hover chip, and the AI section under 400 ms"
slug: "0-1-38-inline-ai-the-framework-s-last"
intent: "Roadmap f-inline-ai-framework-finish, the framework half still open of feature:inline-ai-in-the-context-menu-directed-by-jev (planned by Nick 2026-10-19; its blockers have shipped)."
acceptanceCriteria:
  - "several selected records get a selection bar: the acts they share, and the AI's suggestions for the set from the Fast slot"
  - "a quiet hover chip: at most one, above a confidence threshold, Fast slot only and cached, never on a pass-over, with an off switch for the host and for the person"
  - "a harness claim that the menu's AI section fills in under 400 ms p95 with a Fast slot of realistic latency; AI off still hides every part; tests fail first"
priority: "high"
tags:
  - "roadmap"
  - "0.1.38"
source: "ndx-capture"
resolution: "On feat/inline-ai-finish: the existing selection bar (several-bar.tsx) offers, for two or more chosen, the Fast slot's pick among the acts they share, the kind's panels and places (suggestForSeveral), once per choice; ai.hoverChips: true gives one hover chip after the menu's dwell when the Fast slot is at least 60% sure, with the reader's switch in the person menu; verify-inline-ai measures the menu's AI section at 262–277 ms p95 over twenty opens with a 100–250 ms Fast slot."
---
