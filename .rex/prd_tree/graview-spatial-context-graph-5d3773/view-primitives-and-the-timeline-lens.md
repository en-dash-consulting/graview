---
id: "c7fbbe07-5883-4383-b60c-1f8f64ebc916"
level: "feature"
title: "View primitives and the timeline lens"
status: "pending"
priority: "medium"
tags:
  - "views"
  - "primitives"
  - "lens"
  - "design-system"
blockedBy:
  - "a06aa246-782b-4f85-a65c-cfff749e9f35"
source: "Session planning — architecture"
acceptanceCriteria:
  - "A new node kind renders acceptably at all three fidelities with zero custom view code"
  - "The timeline lens is built only from public primitives, with no private API access"
  - "Field-role mapping lets an app bind its own date fields to the timeline lens"
  - "The framework resolves the correct view cell from cardinality and plane depth"
description: "A rich primitive set plus ONE fully-built exemplar lens — not a full visualization library. Panel, Roster, Chip, Connector, Axis, Grid and Aggregate cover the common cases, so a new node kind renders sensibly before anyone writes a custom view.\n\nThe timeline/calendar lens is built FROM those same public primitives, so it doubles as the worked example of the authoring API. Apps compose primitives or fork the lens and edit it. Nothing is sealed.\n\nViews form a MATRIX, not a list — two axes, cardinality (one / many-aggregate) and fidelity (full / summary / glyph). The framework picks the cell based on plane depth; the author fills it in or inherits a primitive. Full fidelity is live DOM captured every frame; summary is captured on change and cached; glyph is painted in the shader with no capture.\n\nTime is NOT a core framework concern — nodes carry whatever date fields they declare, and lenses that care about time handle it themselves. The timeline lens therefore declares required field roles (start, end, date) that an app maps its own fields onto. This keeps recurrence and calendar math out of the core; the household example keeps owning its own."
---
