---
id: "3e3b9cc7-f449-4144-a1d3-78882d13d155"
level: "feature"
title: "graview doctor says when a product's Graview pins or React pair disagree"
status: "pending"
priority: "high"
tags:
  - "n-dx"
  - "cli"
  - "versions"
source: "n-dx's Graview projection notepad, 2026-10-10 (../n-dx, packages/graview and packages/graview-face)"
acceptanceCriteria:
  - "graview doctor reports mismatched @graview/* and graview pins, formatVersion against the installed core, and a react/react-dom pair that will refuse"
  - "The install docs name the npx-in-pnpm trap"
  - "A test helper compiles a document and seed from paths so products need no fixture copies"
description: "One release means five pins (@graview/core, pages, ship, graview, formatVersion); react 19.2.8 beside react-dom 19.3.0 gave a blank page; npx -y graview@<pinned> fails inside a pnpm workspace that already holds it."
lastModified: "2026-10-10T22:00:00.000Z"
---
