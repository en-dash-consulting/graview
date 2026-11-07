---
id: "4382c67b-1055-4623-b8fb-62b9be3fa330"
type: "constraint"
title: "The scene stays standing — error boundary, chrome floors, phone width, the view in the URL"
slug: "the-scene-stays-standing-error"
statement: "Four things a person can hit in the scene without doing anything wrong: a throwing view blacks out the whole app; the district chrome is two pixels under the framework's own target floor; the scene overflows a 390px viewport; a scrolling panel has no tab stop. Plus: the URL carries the focus but not which view is showing, so no page can link to a lens."
tags:
  - "groundskeeper-feedback"
  - "@graview/react"
  - "@graview/primitives"
source: "groundskeeper-graview/docs/graview-feedback.md"
acceptanceCriteria:
  - "A throwing view renders its own message in its place and the rest of the scene stands"
  - "audit-ui-style measurements at 390px and 1280px hold on the scene chrome"
  - "A page can link to a specific group view of the scene"
priority: "critical"
---
