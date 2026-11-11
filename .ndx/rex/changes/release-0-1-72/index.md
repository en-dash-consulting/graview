---
id: "fa770753-3ffb-411b-8377-fec22882f723"
type: "change"
title: "0.1.72: An app's history opens from the app menu and from a host's own menu; a frame is lent the app's faces; a view chooses its pictures by record; and a frame that only grows with itself is held."
slug: "release-0-1-72"
intent: "What 0.1.72 shipped, recorded after the release from its entry in apps/site/releases.json. The work itself was tracked on Graview HQ and in the four changes it completed."
acceptanceCriteria:
  - "**History is in the app menu.** The chevron beside the app's name has a History row that opens the timeline at now on the scene and the routed face alike, and gives the keyboard to its scrubber. An app with no changes yet says \"No changes yet\". `bar: { history: false }` leaves it out."
  - "**A host opens it from its own menu.** `showHistory()` on the handle `mount` returns opens that mount's timeline, and answers whether one will draw."
  - "**A frame is lent the app's faces.** A `guestView` frame draws in the faces `brand.views.fonts` lends, handed over as `data:` fonts, held to the same 2 MB, and needs only `font-src data:`. A face file is read only where it answers as a font or as plain bytes."
  - "**A view chooses its pictures by record.** A manifest's `pictures` takes `records` (`{ subject: true }` or `{ ids: [...] }`) and `most`, so a view of one record is handed that record's pictures, not every one of its kind. `checkManifest` refuses a malformed choice (`view-pictures-records`, `view-pictures-most`)."
  - "**A frame that grows only with itself is held.** A guest sized by `100vh` that asks for its frame's height each time the frame grows is held at the height it was given, and the host is told why through `onProblem` and `onHeld`."
shippedIn: "0.1.72"
tags:
  - "release"
  - "0.1.72"
source: "apps/site/releases.json"
---
