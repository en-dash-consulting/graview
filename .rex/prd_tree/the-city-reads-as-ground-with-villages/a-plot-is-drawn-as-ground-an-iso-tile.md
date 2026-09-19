---
id: "3ccfe323-8ed8-486e-bc74-6b2deb60e5fa"
level: "task"
title: "A plot is drawn as ground: an iso tile per district in its hue, with a kerb and a cast shadow, and the lattice reads as fields between plots"
status: "pending"
priority: "high"
tags:
  - "city"
  - "altitude"
  - "ground"
acceptanceCriteria:
  - "At altitude every district card has an iso ground tile beneath it, sized from its plot's side on the city cell, in the kind's hue"
  - "The tile rides the card's transform and tween, is absent in the stack, and is aria-hidden"
  - "The lattice between plots reads as ground (visibly present, fading to the horizon), not as a faint hatch"
  - "Survey 34/34, audit 39/39, navigation and robot harnesses pass; a screenshot of todo and rota at altitude is committed under docs/survey"
description: "The layout already gives every district a plot (LayoutNode.plot: col, row, side; Layout.city: cell, originX, originY) and the scene draws lattice roads from them. Nothing draws the plot itself. Draw, under each district card at altitude, the plot's iso rhombus — toIso of its corners on the city cell — filled in the kind's hue at low alpha (light: ~10%, dark: ~18%), with a 1px kerb in the hue and a soft cast shadow toward the light, so the district STANDS on land. The lattice hatch between plots becomes fields: a slightly warmer/darker ground colour than the page, the diamonds at ~8% rather than the current near-invisible lines, fading toward the horizon at the top. Opened districts and their building grids sit inside the tile. The tile tweens with the card (same transform), disappears in the stack, and is pointer-transparent except that clicking a tile focuses its district (same as the card). Screens (drive-ins) get a plot tile too. Audit: no new collisions; survey clean; a11y unaffected (aria-hidden). Reference: Nick's memory \"honest geometry\" — the tile is the plot the layout computed, not decoration."
lastModified: "2026-09-19T14:28:25.955Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
