---
id: "2e45b291-17c3-490a-a4ea-3d8d99cbff33"
type: "capability"
title: "graview preview and graview shots: the default faces on a document and a snapshot, in a browser or headless"
slug: "graview-preview-and-graview-shots-the"
statement: "graview preview and graview shots show a document and a snapshot as the default faces, in a browser or headless, with no product required."
criteria: [{"id":"c1","text":"When given a document and a seed snapshot, graview preview shall serve the scene and Pages over the served store."},{"id":"c2","text":"When given a document and a snapshot, graview shots shall render named places headless to PNGs."},{"id":"c3","text":"When run from npx with no product, graview preview and graview shots shall work."}]
tags:
  - "n-dx"
  - "cli"
  - "first-run"
source: "n-dx's Graview projection notepad, 2026-10-10 (../n-dx, packages/graview and packages/graview-face)"
priority: "high"
resolution: "Done in #200: graview preview serves the store and Graview's own faces from a page built into the graview package; graview shots photographs named places with a Playwright the person installs; verify-preview and smoke-install hold both."
---

graview serve is the store and draws nothing; a stranger with a document and a snapshot expects to see the graph. Every n-dx change was proved with hand-scripted Playwright screenshots. Subsumes 'graview preview: mount the default faces on a document with no product'.
