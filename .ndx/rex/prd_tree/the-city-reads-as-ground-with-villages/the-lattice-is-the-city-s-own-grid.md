---
id: "8435440a-5fac-4e1b-9742-cb513ec6c40b"
level: "task"
title: "The lattice is the city's own grid: pinned to its cells, and it moves with the camera"
status: "completed"
priority: "high"
tags:
  - "graview"
  - "city"
  - "altitude"
source: "Nick: \"Background grid should line up with the city and change alongside elevation/perspective changes\""
startedAt: "2026-09-21T03:30:59.355Z"
completedAt: "2026-09-21T03:52:33.843Z"
endedAt: "2026-09-21T03:52:33.843Z"
resolutionType: "code-change"
resolutionDetail: "Tile-based lattice pinned to the city's origin and cell; interpolate() tweens the city frame and keeps it on descent."
acceptanceCriteria:
  - "A plot's tile corners lie on lattice vertices at every zoom (measured: corner minus origin is a multiple of cell/2 in x and cell/4 in y with matching parity)"
  - "interpolate() lerps city cell and origin between two cities and keeps the source city when the destination has none (unit test)"
  - "Survey and audit screens clean; navigation, who, robot, seat, chat, pages, shrunk pass"
description: "The ground's lattice was four repeating gradients phased from the middle of the box and seamed at the box's edge, so its lines never sat where the city's cells were, and it snapped to the destination cell on the first frame of a zoom or vanished on the first frame of a descent. Drawn now as tiles one cell by half a cell with both diagonals, pinned where cell (0,0) meets the canvas (`--graview-lattice-cell`, `--graview-lattice-x/y`); the interpolated frame tweens the city (cell, origin, extent) between two cities, arrives with the destination when rising, and keeps the city while the ground fades on descent."
lastModified: "2026-09-21T03:52:33.855Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
