---
id: "46f81660-9e33-4ad1-9577-d5ca174365d1"
type: "change"
title: "The authoring guide carries the declaration's complete schema: act args overrides, and workflows' triggers and steps"
slug: "f-authoring-schemas-args-workflows"
intent: "From a Graview Public ticket (brief b-cloud-2026-11-18-forms-guide-asks): validation accepts acts.args but the guide never says so; workflows have no schema or guide topic, and when: [{}] answers only 'Invalid input'. Wanted: an authoritative schema an agent can read, with examples for an optional record input and a conditional effect. Cloud serves get_authoring_guide from it."
acceptanceCriteria:
  - "document.schema.json describes acts.args and workflows' triggers and steps (test)"
  - "The authoring skill or guide topic documents acts.args with an optional record input example and workflows with a trigger example (test: skill text)"
  - "A malformed workflow trigger is refused naming the valid shapes, not 'Invalid input' (test)"
priority: "medium"
tags:
  - "graview"
  - "skills"
  - "hq:feature:f-authoring-schemas-args-workflows"
source: "Graview HQ feature:f-authoring-schemas-args-workflows"
---
