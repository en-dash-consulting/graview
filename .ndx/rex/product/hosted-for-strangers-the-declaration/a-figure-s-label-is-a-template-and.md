---
id: "d2754e2b-c068-4093-a346-fbd705362c27"
type: "capability"
title: "A figure's label is a template, and check flags braces in any non-template string (FR-99)"
slug: "a-figure-s-label-is-a-template-and"
statement: "A figure's label is a template whose braces draw the record's fields, and graview check flags a brace in any non-template block string."
criteria: [{"id":"c1","text":"When a figure's label is written as a template such as \"{name}, net\", the figure shall draw the record's name in place of the braced field."},{"id":"c2","text":"If a non-template block string contains a brace, graview check shall report a finding that names the block."}]
tags:
  - "graview-cloud"
  - "FR-99"
  - "chat-authored"
source: "Graview Cloud, 2026-10-06 (brief after 0.1.10)"
priority: "medium"
---

LifeLogics' 'The Coaching package, net' became two blocks; check said nothing.
