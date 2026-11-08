---
id: "de75d28d-c5cd-4c33-b3e7-d9a9fbca0fe4"
type: "capability"
title: "The AI rail can be put away: collapse to a tab, overlay when narrow, and a host's starting state (FR-78)"
slug: "the-ai-rail-can-be-put-away-collapse"
statement: "The AI rail can be collapsed to a slim tab, overlays the scene when the window is narrow, and starts in a state the host chooses."
criteria: [{"id":"c1","text":"The actions strip shall provide a control that collapses the companion to a slim tab and opens it again."},{"id":"c2","text":"The system shall remember the companion's collapsed or open state per reader."},{"id":"c3","text":"While the window is below the narrow-width threshold, the companion shall overlay the scene instead of taking a column."},{"id":"c4","text":"When a host calls mount with the companion option set to \"open\", \"collapsed\" or \"hidden\", the system shall start the companion in that state."},{"id":"c5","text":"While the companion is collapsed, the scene and its controls shall use the whole width."}]
tags:
  - "graview-cloud"
  - "FR-78"
source: "Graview Cloud, 2026-10-05 (brief after 0.1.8; staging live at staging.graview.cloud)"
priority: "medium"
---

The companion takes a fixed column on every wide screen whether or not the person is talking to it, and squeezes the scene on a narrow window.
