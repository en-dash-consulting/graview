---
id: "fef02523-41fc-45ac-a2ab-abc95ea0abe8"
type: "change"
title: "A move belongs to the stop it was made at"
slug: "a-move-belongs-to-the-stop-it-was-made"
intent: "Pins and pan are stored by node id in canvas pixels and were carried to the next stop, holding the card you had dragged as the focus at coordinates that meant nothing there, drawn over the new focus. Changing the focus, rising or descending, and zooming now start where the layout puts things; the old stop keeps its arrangement in its own address so Back returns to it. Also: `focus=agg:<kind>` is a stop's short form, understood by the URL codec."
touches:
  - "95eebd39-8c1a-47fc-9b58-818eecb58e85"
priority: "high"
tags:
  - "layout"
  - "url-state"
source: "claude-code session 2026-09-10"
---
