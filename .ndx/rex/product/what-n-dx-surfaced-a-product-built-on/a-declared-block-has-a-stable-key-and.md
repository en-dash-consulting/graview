---
id: "5428bc1e-2b8c-4fc7-bcb4-b6d2f4c42501"
type: "capability"
title: "A declared block has a stable key, and a face claims a slot by it"
slug: "a-declared-block-has-a-stable-key-and"
statement: "A declared block in a view has a stable key, and a face claims the slots it draws by that key while the framework draws every other one."
criteria: [{"id":"c1","text":"The framework shall give every block in a view a key, declared or derived stably, and carry it through resolveBlocks."},{"id":"c2","text":"When a face names the slots it draws by key, the framework shall draw every slot the face does not name."},{"id":"c3","text":"When a block's title is renamed, the framework shall keep the set of slots a face claims unchanged."},{"id":"c4","text":"If two blocks in a view share a key, graview check shall refuse the declaration."}]
tags:
  - "n-dx"
  - "blocks"
  - "faces"
source: "n-dx's Graview projection notepad, 2026-10-10 (../n-dx, packages/graview and packages/graview-face)"
priority: "high"
resolution: "Done in #202: every block keeps a key, the declaration's or one derived from its sort and place (list.2), never its words, carried through resolveBlocks; a face claims blocks by key with BlockSlots ({ \"change.page\": { rewrites: Mine } }) and the framework draws the rest; graview check refuses two in one view (view-key)."
---

The n-dx face takes over Runs and Tasks on a change page and lets declared blocks draw the rest by matching title text (src/ui/screens/change.tsx); rename a title and the face silently drops a section.
