---
id: "44f849d2-6621-424c-83de-9100985e5df7"
level: "feature"
title: "The structural findings sourcevision left after 0.1.17"
status: "pending"
priority: "medium"
acceptanceCriteria: []
description: "After #161 broke the import cycles that ran at load (35 to 17, all left type-only) and left generated bundles out of the analysis, sourcevision's re-clustered zones report new critical structural findings it did not refactor, one release away: fragile core zones (core, core-document, core-graph, core-invariants, check, findings, document each with its own cohesion and coupling finding); a god function in scripts/verify-pages.mjs (<module>, 143 callees); and Scene in packages/react/src/scene-root.tsx (108 callees). The 17 type-only cycles left: core app.ts and the document views via to-document.ts, theme types and the kit, places and views/types, seen and store, check and its context, scaffold names, embed's where, the bar panes' door. Each is split or left with a reason, and ndx analyze run again."
lastModified: "2026-10-08T22:09:15.053Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
