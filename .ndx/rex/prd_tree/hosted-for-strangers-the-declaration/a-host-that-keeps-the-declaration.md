---
id: "6ad5b5bf-31b8-463e-983c-fea7ad8e2438"
level: "feature"
title: "A host that keeps the declaration chooses who sees the studio (FR-59)"
status: "completed"
startedAt: "2026-10-04T15:31:00.000Z"
completedAt: "2026-10-04T15:31:00.000Z"
endedAt: "2026-10-04T15:31:00.000Z"
priority: "medium"
tags:
  - "graview-cloud"
  - "FR-59"
source: "Graview Cloud, 2026-10-04 (brief after 0.1.4)"
acceptanceCriteria:
  - "StudioPlace and the embed's mount take studio: { onApply, offered: true } (or a may predicate) that overrides maySeeTheStudio"
  - "On the vendors fixture an editor (no grant gives them '*') sees data-testid='studio' with the app's policy left on the store"
description: "maySeeTheStudio judges only by the app's own policy; Cloud has already decided who may build, and today hands the embed a store with no policy to get round it."
lastModified: "2026-10-04T15:31:00.000Z"
---
