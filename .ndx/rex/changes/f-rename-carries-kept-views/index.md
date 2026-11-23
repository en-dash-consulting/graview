---
id: "6364e4a9-0c3e-4464-a656-af1604cdf631"
type: "change"
title: "Renaming a relation, field or kind carries the kept views that read it, or the preview says they will break"
slug: "f-rename-carries-kept-views"
intent: "From HQ feature:f-rename-carries-kept-views and Cloud's brief b-cloud-2026-11-23-rename-carries-views: a rename-relation updatedBy -> recheckedBy on 9 kinds previewed as not breaking (links kept, computed expressions followed), but all 14 kept worker views named updatedBy in manifest.reads.edges and in their source, so after the apply every manifest no longer fit the app and the pages fell back to derived ones. Ask: (1) a rename's preview names each kept view whose manifest reads the renamed relation, field or kind and counts it as breaking for those views; (2) better, the rename rewrites those manifests in the same change (one undo), and says which views' sources still name the old key. Needed now because 0.2.10's reserved names force renames in apps with kept views."
acceptanceCriteria:
  - "A rename's preview names every kept view whose manifest reads the renamed relation, field or kind, and is breaking for them unless carried (test)"
  - "Applying the rename rewrites those manifests in the same change, so each view still fits the app, and one undo takes both back (test)"
  - "The change says each view whose source still names the old key (test)"
priority: "medium"
tags:
  - "graview"
  - "core"
  - "guest"
  - "hq:feature:f-rename-carries-kept-views"
source: "Graview HQ feature:f-rename-carries-kept-views"
---
