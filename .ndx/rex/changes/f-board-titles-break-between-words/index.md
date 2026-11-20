---
id: "7d79f708-ffdf-492a-bd65-1b05b046bbb9"
type: "change"
title: "A board's title breaks between words on every system's type"
slug: "f-board-titles-break-between-words"
intent: "Found by PR #637 on GitHub's Linux runner, 2026-11-16: in DejaVu (system-ui on Linux) multi-word board titles break mid-word ('Research/ers', 'Extinctio/ns'). Real and visible to people on Linux; no claim checks it. Ask: titles wrap only between words (or hyphenate properly), and a one-face claim checks that no word is split, on the runner's type."
acceptanceCriteria:
  - "No board title on the one face at Nearby or Map splits a word across lines, on the Linux runner's type and on macOS (claim: noBoardTitleSplitsAWord)"
  - "A single word too long for the board is shortened with an ellipsis rather than broken (claim)"
priority: "medium"
tags:
  - "graview"
  - "pages"
  - "hq:feature:f-board-titles-break-between-words"
source: "Graview HQ feature:f-board-titles-break-between-words"
---
