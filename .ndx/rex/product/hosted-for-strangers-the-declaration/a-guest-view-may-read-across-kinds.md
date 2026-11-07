---
id: "b3be1519-795e-463d-aaeb-ca27df2a353e"
type: "capability"
title: "A guest view may read across kinds, gets labels, and may attach to the home (FR-85)"
slug: "a-guest-view-may-read-across-kinds"
statement: "A guest view can read records and edges across kinds beyond its own, receives labels on its nodes as the host labels records, and can attach to the app's home."
criteria: [{"id":"c1","text":"When a guest registration declares reads with kinds or edges, the host shall add those records and edges to what the guest receives, as the viewer sees them."},{"id":"c2","text":"The host shall fill GuestNode.label for each node as it labels the corresponding record."},{"id":"c3","text":"Where a guest view is registered to attach to the home, the host shall render it as the home body."},{"id":"c4","text":"When a frame guest over package declares reads of offer and includes, the host shall give it each package's offers."},{"id":"c5","text":"If an offer is not seen by the viewer, the host shall leave it out of the guest's nodes and edges."}]
tags:
  - "graview-cloud"
  - "FR-85"
  - "chat-authored"
  - "frames"
source: "Graview Cloud, 2026-10-05 (brief after 0.1.9: chat-authored interfaces, ADR 0007)"
priority: "low"
---

A many guest sees only its kind's members and their edges; GuestNode.label is declared but never filled. For owner-uploaded frames; the worker form is FR-91.
