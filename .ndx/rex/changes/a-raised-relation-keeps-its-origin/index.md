---
id: "0e68e9be-34ea-4b0a-afab-19df1e0f42c1"
type: "change"
title: "A raised relation keeps its origin visible"
slug: "a-raised-relation-keeps-its-origin"
intent: "Raising a kind moves its members to plane 1 and the group vanishes from the context plane, so the only evidence of what is raised is the breadcrumb. The group should stay where it was, marked as raised and emptied, so the eye can tie the relation plane back to where it came from — and clicking it again drops it."
acceptanceCriteria:
  - "Raising a kind leaves its group on the context plane, visibly marked as raised"
  - "The marked group is a click target that drops the relation"
  - "Spatial memory holds: the group does not move when it is raised"
  - "Layout tests assert the group is still placed and still inside the canvas"
touches:
  - "2b687f3c-6253-4b93-86cf-0e592ae9fcdf"
priority: "high"
---
