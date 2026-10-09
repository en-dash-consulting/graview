---
id: "44f849d2-6621-424c-83de-9100985e5df7"
level: "feature"
title: "The structural findings sourcevision left after 0.1.17"
status: "pending"
priority: "medium"
acceptanceCriteria: []
description: "After #161 broke the import cycles that ran at load (35 to 17, all left type-only) and left generated bundles out of the analysis, sourcevision's re-clustered zones report new critical structural findings it did not refactor, one release away: fragile core zones (core, core-document, core-graph, core-invariants, check, findings, document each with its own cohesion and coupling finding); a god function in scripts/verify-pages.mjs (<module>, 143 callees); and Scene in packages/react/src/scene-root.tsx (108 callees). The 17 type-only cycles left: core app.ts and the document views via to-document.ts, theme types and the kit, places and views/types, seen and store, check and its context, scaffold names, embed's where, the bar panes' door. What #161 named for the follow-up: pin core's zone map; narrow the document/* imports of ../index.js; split the Scene god function in packages/react/src/scene-root.tsx; end or justify the 17 remaining type-only cycles. Each is split or left with a reason, and ndx analyze run again."
lastModified: "2026-10-09T12:00:00.000Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---

## Notes

2026-10-09, the cleanup after the seat (chore/cleanup-after-the-seat): the document's `../index.js` imports are narrowed in `migrate.ts`, `to-document.ts` and `describe-place.ts` (type-only cycles were not re-counted; `ndx analyze` was not run). `compiled.ts` and `rules.ts` keep the barrel on purpose, and say why in a comment: narrowed, each changed how esbuild splits a hosted page's first chunks and cost 0.3–0.5 KB up front (`pnpm verify hosted`). Left open: pinning core's zone map, splitting the Scene god function in `packages/react/src/scene-root.tsx` and the god function in `scripts/verify-pages.mjs`, the remaining type-only cycles (theme types and the kit, places and views/types, seen and store, check and its context, scaffold names, embed's where, the bar panes' door), and running `ndx analyze` again.
