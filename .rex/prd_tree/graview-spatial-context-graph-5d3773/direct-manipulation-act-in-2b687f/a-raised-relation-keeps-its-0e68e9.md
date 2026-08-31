---
id: "0e68e9be-34ea-4b0a-afab-19df1e0f42c1"
level: "task"
title: "A raised relation keeps its origin visible"
status: "pending"
priority: "high"
acceptanceCriteria:
  - "Raising a kind leaves its group on the context plane, visibly marked as raised"
  - "The marked group is a click target that drops the relation"
  - "Spatial memory holds: the group does not move when it is raised"
  - "Layout tests assert the group is still placed and still inside the canvas"
description: "Raising a kind moves its members to plane 1 and the group vanishes from the context plane, so the only evidence of what is raised is the breadcrumb. The group should stay where it was, marked as raised and emptied, so the eye can tie the relation plane back to where it came from — and clicking it again drops it."
---
