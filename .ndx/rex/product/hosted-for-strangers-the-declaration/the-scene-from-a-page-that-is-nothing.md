---
id: "0853f952-c9bf-4392-8052-bcfddbf25d59"
type: "capability"
title: "The scene from a page that is nothing lands where the scene opens (FR-157)"
slug: "the-scene-from-a-page-that-is-nothing"
statement: "On the Pages face at an address no route answers, the bar's Scene control lands the scene where it opens rather than on the empty view."
criteria: [{"id":"c1","text":"When the Pages face is at an address no route answers, the bar's Scene control shall land where the scene opens: where the declaration says the app opens, else at altitude on the Graview's face."},{"id":"c2","text":"When the Pages face is at an address no route answers, the bar's Scene control shall not land on the empty view (no focus, overview off, the control saying Up)."},{"id":"c3","text":"Under address routing, the Scene control shall push the address of the stop where the scene opens, so that a step Back undoes it."},{"id":"c4","text":"Under memory routing, the Scene control shall move the scene's view to the stop where the scene opens."},{"id":"c5","text":"When the scene's view holds a focus or is at altitude, the Scene control shall take that view as it was."}]
tags:
  - "graview-cloud"
  - "FR-157"
  - "embed"
  - "faces"
source: "Graview Cloud, \"The dev kit, as an agent meets it\" (2026-10-10); labeled FR-156 there, which had already shipped as a connect that replaces replaces"
priority: "medium"
resolution: "Fixed in #186: when the view the switch would take holds nothing, it lands where the declaration says the app opens (pages.first), else at altitude on the Graview's face; unit tests in @graview/embed and the address harness's theSceneFromAnAddressNothingLivesAtLandsWhereTheSceneOpens."
---

On the Pages face at an address no route answers ("Nothing lives at this address."), the bar's Scene control landed the scene at /places/overview#: the empty view, overview off, the control saying Up. The pages leave the scene's view holding nothing when no page named a place in it, and the switch took that view as it was.
