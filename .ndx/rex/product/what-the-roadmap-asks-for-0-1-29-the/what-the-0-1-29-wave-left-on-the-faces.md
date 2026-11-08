---
id: "287f2e32-efff-47ad-b9e4-d6f851f656b3"
type: "capability"
title: "What the 0.1.29 wave left on the faces: covered districts, the Shell's resolveApp, the studio"
slug: "what-the-0-1-29-wave-left-on-the-faces"
statement: "The product keeps its faces navigable and consistent: the Shell resolves apps itself, and the studio lists the current field types and names each lens node distinctly."
criteria: [{"id":"c1","text":"When a district is covered by the floating panel, Tab navigation shall skip that district."},{"id":"c2","text":"The Shell shall take resolveApp itself."},{"id":"c3","text":"The studio shall list app-link and the new field types in its field-type list."},{"id":"c4","text":"When two lenses of one name are declared on different kinds, the studio shall give them distinct node ids."}]
tags:
  - "roadmap"
  - "0.1.29"
source: "Nick, 2026-10-14: \"i think any that can be picked up should be picked up.\""
priority: "medium"
resolution: "On fix/wave-leftovers-faces: Tab passes over a district wholly under the floating panel and the camera brings the one it lands on into the part that is seen (verify-navigation tabNeverLandsOnADistrictThePanelCovers, at 1440 and 390); `<Shell resolveApp>`; the studio's FIELD_TYPES is the document's own list (app-link, image, file, and whatever the document gains), and a lens's node id names the kinds it stands on, `lens:columns:board@task`."
---

Follow-ups the wave named.
