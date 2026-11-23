---
id: "2d8b0ec3-66e8-4841-ba66-a509d736202c"
type: "change"
title: "A workflow step can publish an app's drafts"
slug: "f-workflow-step-publishes"
intent: "From HQ feature:f-workflow-step-publishes: a scheduled sync ends with Publish, but no act publishes, so a workflow needs an outside agent to finish. A workflow step can publish the app's drafts under the same approval policy as other steps, and the run log says what was published. Check first whether publishing is already reachable as an act; if it is, fold it into the step kinds."
acceptanceCriteria:
  - "A workflow with a publish step moves the published marker to the head when its approval policy allows (test)"
  - "A dry run says what it would publish and publishes nothing (test)"
  - "The run log names what was published (test)"
priority: "medium"
tags:
  - "graview"
  - "core"
  - "workflows"
  - "hq:feature:f-workflow-step-publishes"
source: "Graview HQ feature:f-workflow-step-publishes"
---
