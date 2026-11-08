---
id: "8eeb5a36-c027-45e5-bcd6-7dfa55799e77"
type: "capability"
title: "A host speaks in the app's own notices: notify() on the embed handle (FR-75)"
slug: "a-host-speaks-in-the-app-s-own-notices"
statement: "The embed handle lets a host speak in the app's own notices through notify({ kind: \"toast\" | \"banner\", sentence, … }), drawn in the framework's floating-panel look."
criteria: [{"id":"c1","text":"The system shall ensure that the embed handle exposes notify({ kind: \"toast\" | \"banner\", sentence, … }) drawn in the framework's own floating-panel look, on the notices layer (FR-76), in both schemes."},{"id":"c2","text":"The system shall ensure that A banner can be cleared by the host; Cloud's newer-build notice, offline and held banners, conflict card and toasts can move onto it."}]
tags:
  - "graview-cloud"
  - "FR-75"
source: "Graview Cloud, 2026-10-05 (brief after 0.1.8; staging live at staging.graview.cloud)"
priority: "medium"
---

Cloud's notices are its own DOM restyled by hand to look like the framework's floating panels. NOTE: the ask arrived truncated at 'notify({ kind: "toast" | "banner".' — criteria above are the framework's reading; confirm with Cloud.
