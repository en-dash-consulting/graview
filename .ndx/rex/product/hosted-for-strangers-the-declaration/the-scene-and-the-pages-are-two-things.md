---
id: "0e34e849-8b72-4900-8e4a-37f12b3aa79e"
type: "capability"
title: "The scene and the pages are two things, and the bar says so (FR-137)"
slug: "the-scene-and-the-pages-are-two-things"
statement: "The product's bar carries a two-state switch beside the app's name that lets a person move between the scene and the pages."
criteria: [{"id":"c1","text":"The bar shall place one compact switch right after the app's name, with an icon and a word each for 'Scene' and 'Pages' (a declaration may rename them), about 150 px wide on a desk."},{"id":"c2","text":"On a phone, the switch shall show icons only and keep the words as accessible names."},{"id":"c3","text":"The switch shall be a real two-state control (aria-pressed or a tablist of two) that marks the current state."},{"id":"c4","text":"When a person chooses Scene, the app shall draw the scene under the bar."},{"id":"c5","text":"When a person chooses Pages, the app shall return to the page they were on."},{"id":"c6","text":"The app shall keep addresses as they were (/places/overview and the rest), and links, where() and setApp shall not change."},{"id":"c7","text":"On a desk and on a phone, the bar shall let a first-time reader point to the way to the scene and to the pages without opening anything."},{"id":"c8","text":"The bar and the page shall not use the word 'overview' for the scene."}]
tags:
  - "graview-cloud"
  - "FR-137"
  - "design"
  - "a11y"
source: "Graview Cloud, 2026-10-08 (handoff: scene or pages, in one glance — from Nick on 0.1.16; replaces FR-135)"
priority: "critical"
resolution: "Shipped in #143 (0.1.17): the bar's switch, app-face-scene and app-face-pages with aria-pressed, renamed by pages.scene and pages.pages (pages.overview read as pages.scene); Pages returns to the page you were on. The review after 0.1.16 made Pages work in a narrow embed after the reader asked for the scene, cut a long word on the switch, and added pages-faces-alike."
---

Nick: 'the new nav kinda sucks, and i don't see a way to go to the scene vs pages anymore'. FR-132 made the scene 'Overview', one of seven equal tabs, so seeing the whole app lost its door.
