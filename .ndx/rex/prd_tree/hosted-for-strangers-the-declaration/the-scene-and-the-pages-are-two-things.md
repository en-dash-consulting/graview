---
id: "0e34e849-8b72-4900-8e4a-37f12b3aa79e"
level: "feature"
title: "The scene and the pages are two things, and the bar says so (FR-137)"
status: "completed"
priority: "critical"
tags:
  - "graview-cloud"
  - "FR-137"
  - "design"
  - "a11y"
source: "Graview Cloud, 2026-10-08 (handoff: scene or pages, in one glance — from Nick on 0.1.16; replaces FR-135)"
completedAt: "2026-10-08T14:10:55.000Z"
endedAt: "2026-10-08T14:10:55.000Z"
acceptanceCriteria:
  - "Right after the app's name sits one compact switch: an icon and a word each, 'Scene' and 'Pages' (a declaration may rename them), about 150 px on a desk; icons only on a phone with the words as accessible names"
  - "A real two-state control (aria-pressed or a tablist of two), the current one marked; Scene draws the scene under the bar, Pages returns to the page you were on"
  - "Addresses stay as FR-132 made them (/places/overview and the rest); links, where() and setApp don't change"
  - "On a desk and a phone a first-time reader can point to the way to the scene and to the pages without opening anything; nothing else in the bar or the page says 'overview' for the scene"
description: "Nick: 'the new nav kinda sucks, and i don't see a way to go to the scene vs pages anymore'. FR-132 made the scene 'Overview', one of seven equal tabs, so seeing the whole app lost its door."
lastModified: "2026-10-08T15:30:00.000Z"
resolution: "Shipped in #143 (0.1.17): the bar's switch, app-face-scene and app-face-pages with aria-pressed, renamed by pages.scene and pages.pages (pages.overview read as pages.scene); Pages returns to the page you were on. The review after 0.1.16 made Pages work in a narrow embed after the reader asked for the scene, cut a long word on the switch, and added pages-faces-alike."
---
