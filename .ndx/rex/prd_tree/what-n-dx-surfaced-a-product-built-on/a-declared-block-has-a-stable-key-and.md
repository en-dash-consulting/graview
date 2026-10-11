---
id: "5428bc1e-2b8c-4fc7-bcb4-b6d2f4c42501"
level: "feature"
title: "A declared block has a stable key, and a face claims a slot by it"
status: "pending"
priority: "high"
tags:
  - "n-dx"
  - "blocks"
  - "faces"
source: "n-dx's Graview projection notepad, 2026-10-10 (../n-dx, packages/graview and packages/graview-face)"
acceptanceCriteria:
  - "Every block in a view has a key (declared or derived stably), carried through resolveBlocks"
  - "A face says which slots it draws by key and the framework draws every other one"
  - "Renaming a block's title changes nothing a face claims"
  - "graview check refuses duplicate keys"
description: "The n-dx face takes over Runs and Tasks on a change page and lets declared blocks draw the rest by matching title text (src/ui/screens/change.tsx); rename a title and the face silently drops a section."
lastModified: "2026-10-10T22:00:00.000Z"
---
