---
id: "c45e1f45-05e1-4570-82c7-7d2893fa8dbf"
type: "capability"
title: "A worker view is a place, with a manifest the host enforces (FR-91)"
slug: "a-worker-view-is-a-place-with-a"
statement: "A worker view is a script with a manifest that the host enforces, and it appears as a place, or as the home body, drawn from only the data its manifest reads."
criteria: [{"id":"c1","text":"A worker view's manifest shall declare name, attach (a kind or \"home\") and cardinality, and may declare title, reads and acts."},{"id":"c2","text":"The host shall give a worker view props that are the viewer's sight limited to the manifest's reads, with label filled."},{"id":"c3","text":"When a worker view's manifest has a title, the host shall present the view as a named place on both faces."},{"id":"c4","text":"When a worker view's manifest sets attach to home, the host shall make the view the home body."},{"id":"c5","text":"The host shall pass theme tokens to a worker view in its props and shall push them again when the scheme is toggled."},{"id":"c6","text":"The LifeLogics package lens, written as a worker view, shall read offers and includes, appear as a place titled 'The packages' on both faces, and list each package's offers."},{"id":"c7","text":"When an offer is not in the viewer's sight, the package lens shall leave that offer out."},{"id":"c8","text":"When the scheme is toggled, the package lens shall be restyled to the new scheme."},{"id":"c9","text":"The host shall apply an act from a worker view only when the manifest names that act."},{"id":"c10","text":"While sights are on, the host shall refuse an act from a worker view unless it comes from a press the host saw on an element the view drew, with arguments taken only from the bound record, manifest constants and input values the host read."}]
tags:
  - "graview-cloud"
  - "FR-91"
  - "chat-authored"
  - "security"
  - "tier-2"
source: "Graview Cloud, 2026-10-05 (brief after 0.1.9: chat-authored interfaces, ADR 0007)"
priority: "high"
---

FR-85, FR-86 and FR-87 folded in for workers.
