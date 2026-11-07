---
id: "bdee0e4e-8cf3-4b73-b77f-f704a9e97859"
type: "change"
title: "0.1.45: A form for a visitor, cards that open on a phone's tap, and views that link out, bleed and stack their stylesheets."
slug: "release-0-1-45"
intent: "What 0.1.45 shipped, recorded after the release from its entry in apps/site/releases.json. The work itself was tracked on the Graview Roadmap app."
acceptanceCriteria:
  - "A form for a visitor. An app can declare a form — one act drawn alone for somebody with no account — whose answer lands as a record and shows nothing else of the app. `@graview/embed/form` mounts it anywhere."
  - "A card opens on a tap. Any element a view binds to a record or a place opens it on a click, a phone's tap and Enter, from wherever inside it the press lands. Any element bound to an act presses as a button does, and a headless run can press it and say what it would send."
  - "Views link out, safely. A view may link to an address a record it was shown holds, drawn to open in a new tab with no referrer; an address the view built is refused, so a link cannot carry what the view read."
  - "Every stylesheet is drawn. A view that calls `graview.style` twice draws both, in order."
  - "A view can go edge to edge on a phone with `bleed: true`, and a record page draws its slot under a view that does not replace the page."
  - "The keyboard goes where an act asks, and the undo key the offer names is the one the journeys press."
shippedIn: "0.1.45"
tags:
  - "backfill"
  - "0.1.45"
source: "apps/site/releases.json"
---
