---
id: "3e3b9cc7-f449-4144-a1d3-78882d13d155"
level: "feature"
title: "graview doctor says when a product's Graview pins or React pair disagree"
status: "completed"
priority: "high"
tags:
  - "n-dx"
  - "cli"
  - "versions"
source: "n-dx's Graview projection notepad, 2026-10-10 (../n-dx, packages/graview and packages/graview-face)"
startedAt: "2026-10-11T02:05:00.000Z"
completedAt: "2026-10-11T03:10:00.000Z"
endedAt: "2026-10-11T03:10:00.000Z"
acceptanceCriteria:
  - "graview doctor reports mismatched @graview/* and graview pins, formatVersion against the installed core, and a react/react-dom pair that will refuse"
  - "The install docs name the npx-in-pnpm trap"
  - "A test helper compiles a document and seed from paths so products need no fixture copies"
description: "One release means five pins (@graview/core, pages, ship, graview, formatVersion); react 19.2.8 beside react-dom 19.3.0 gave a blank page; npx -y graview@<pinned> fails inside a pnpm workspace that already holds it."
lastModified: "2026-10-11T03:10:00.000Z"
resolution: "Done in #200: graview doctor says pins, lockfile, install, document format and React's pair, each with its fix, exiting 1 on a problem; compileDocumentFiles in @graview/core/testing; the getting-started page, the graview README and the new-app skill name the npx-in-pnpm trap."
---
