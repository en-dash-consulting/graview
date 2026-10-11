---
id: "2e45b291-17c3-490a-a4ea-3d8d99cbff33"
level: "feature"
title: "graview preview and graview shots: the default faces on a document and a snapshot, in a browser or headless"
status: "pending"
priority: "high"
tags:
  - "n-dx"
  - "cli"
  - "first-run"
source: "n-dx's Graview projection notepad, 2026-10-10 (../n-dx, packages/graview and packages/graview-face)"
acceptanceCriteria:
  - "graview preview <doc> --seed <snapshot> serves the scene and Pages over the served store"
  - "graview shots <doc> <snapshot> renders named places headless to PNGs"
  - "Both work from npx with no product"
description: "graview serve is the store and draws nothing; a stranger with a document and a snapshot expects to see the graph. Every n-dx change was proved with hand-scripted Playwright screenshots. Subsumes 'graview preview: mount the default faces on a document with no product'."
lastModified: "2026-10-10T22:00:00.000Z"
---
