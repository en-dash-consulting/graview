---
id: "ed0eca5b-135c-4206-bdba-75f29554bff1"
level: "task"
title: "A district is a village: its members stand as small buildings on the plot, the landmark among them, so the population is the size of the cluster"
status: "completed"
priority: "high"
tags:
  - "city"
  - "altitude"
  - "buildings"
startedAt: "2026-09-20T04:51:29.132Z"
completedAt: "2026-09-20T05:10:51.992Z"
endedAt: "2026-09-20T05:10:51.992Z"
resolutionType: "code-change"
resolutionDetail: "Members stand as buildings on the plot's sub-lattice with the square kept free; flagged roofs and lit selections; the anonymous block retired."
acceptanceCriteria:
  - "A district with n members shows min(n, cap) buildings on its plot at altitude, plus +rest on the kerb; the anonymous block is no longer drawn at altitude"
  - "The kind's landmark stands among the buildings, larger, where the kind has a figure"
  - "Flagged and selected members are legible on their buildings"
  - "Survey, audit, navigation, robot and seat harnesses pass; unit tests cover the building count and cap per side"
description: "Today a district from altitude is one glyph (an iso block or the kind's landmark) whose population is a height nobody reads; the buildings grid appears only when a district is opened. Make the village the default: on the plot tile, draw one small iso building per member up to a cap set by the plot's side (side 1: up to 4, side 2: up to 9, side 3: 16, side 4: 25; the rest as a +n on the kerb), laid out on the plot's own sub-lattice, in the kind's hue with three shaded faces, heights varying slightly by a stable hash of the member id so a village is not a barracks. The kind's landmark (where it has one) stands at the plot's centre-back among the buildings, larger, as the hall/church; the anonymous iso block is retired at altitude. A flagged member's building carries the warning colour on its roof. Selecting a member lights its building (existing activity/selection hues). The nameplate keeps its count. Opened districts keep the current chip grid INSIDE the plot (chips over buildings), or replace it with labelled buildings if that reads better at side ≥ 3. Performance: buildings are one SVG per district, no per-building React state; the survey's animation and count checks stay clean."
lastModified: "2026-09-20T05:10:52.004Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
