---
id: "b1b10bfc-bf14-41a8-8227-b6493c5a8a91"
type: "change"
title: "The embed's mount takes sceneUnderPages and puts its bar in the one face's bar slot"
slug: "f-embed-mount-takes-scene-under-pages"
intent: "Cloud, 2026-11-12 (briefs b-cloud-2026-11-12-embed-one-face and b-cloud-2026-11-12-one-face-through-the-embed): Cloud draws every app's page through @graview/embed's mount, which in 0.2.0 takes no sceneUnderPages (not in EmbedOptions, FrameOptions or PagesEmbedOptions). Mount takes sceneUnderPages and draws the one face with the views it already has; off draws exactly as 0.1.74. With it on, the embed's own bar sits in the one face's fixed bar slot (or above ONE_FACE_LAYERS), so the app's name, places, Find, notices, Share and the person menu stay at Page, Nearby and City. The content box's overflow: auto and the root's isolation: isolate must not break the one face. The slot gets a public attribute Cloud may lean on. Cloud patches 0.2.0 as INTERIM(FR-239) until this ships; list FR-239 in capabilities().shipped."
acceptanceCriteria:
  - "mount({ sceneUnderPages: true }) draws the one face; without it the page draws as 0.1.74 did (test)"
  - "With sceneUnderPages on, the embed's bar is visible and pressable at Page, Nearby and City at 1280 and 390 wide (harness)"
  - "Keys 1, 2, 3, [ and ] move levels on an embed-mounted one face (harness)"
  - "The bar slot carries a public attribute documented for hosts (test)"
  - "capabilities().shipped names FR-239 (test)"
touches:
  - "2b687f3c-6253-4b93-86cf-0e592ae9fcdf"
  - "83796ab4-ebd4-48f4-ad70-81121f49d17d"
priority: "high"
tags:
  - "graview"
  - "embed"
  - "pages"
  - "hq:feature:f-embed-mount-takes-scene-under-pages"
source: "Graview HQ feature:f-embed-mount-takes-scene-under-pages"
---
