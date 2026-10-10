---
id: "0853f952-c9bf-4392-8052-bcfddbf25d59"
level: "feature"
title: "The scene from a page that is nothing lands where the scene opens (FR-157)"
status: "completed"
priority: "medium"
tags:
  - "graview-cloud"
  - "FR-157"
  - "embed"
  - "faces"
source: "Graview Cloud, \"The dev kit, as an agent meets it\" (2026-10-10); labeled FR-156 there, which had already shipped as a connect that replaces replaces"
startedAt: "2026-10-10T03:36:35.000Z"
completedAt: "2026-10-10T03:36:35.000Z"
endedAt: "2026-10-10T03:36:35.000Z"
acceptanceCriteria:
  - "On the Pages face at an address no route answers, the bar's Scene control lands where the scene opens: where the declaration says the app opens, else at altitude on the Graview's face"
  - "It never lands on the empty view (no focus, overview off, the control saying Up)"
  - "Under address routing the address pushed is that stop, a step Back undoes; under memory routing the scene's view moves there"
  - "A view that holds a focus or is at altitude is taken as it was"
description: "On the Pages face at an address no route answers (\"Nothing lives at this address.\"), the bar's Scene control landed the scene at /places/overview#: the empty view, overview off, the control saying Up. The pages leave the scene's view holding nothing when no page named a place in it, and the switch took that view as it was."
lastModified: "2026-10-10T03:36:35.000Z"
resolution: "Fixed in the pull request from kit/an-agent-opens-the-repo-cold: when the view the switch would take holds nothing, it lands where the declaration says the app opens (pages.first), else at altitude on the Graview's face; unit tests in @graview/embed and the address harness's theSceneFromAnAddressNothingLivesAtLandsWhereTheSceneOpens."
---
