---
id: "e03acb48-2e81-43e4-9b7f-c3fd2ef33527"
type: "change"
title: "A worker view, and a frame through its bridge, is told what its seat cannot see"
slug: "f-view-knows-what-its-seat-cannot-see"
intent: "HQ, 2026-11-10: a worker view can work for its author and look empty or break for a signed-out visitor or a lower role, and nothing tells the author. Ask: hand a view what its seat withholds — the kinds, the fields per kind, and a withheld count per list where the sight rules allow saying one, never a count or a name the seat may not know of — and where a part reads only kinds the seat cannot see, draw the sentence for a reader with no acts (FR-183) instead of an empty part."
acceptanceCriteria:
  - "A worker view is handed props.unseen: the kinds it reads that the seat sees none of, and the fields per kind its sight may keep, read from the policy (test)"
  - "Nothing of any record is handed through props.unseen — no count, no id, no value — and no hidden value or label reaches the wire (test)"
  - "A frame guest is handed only the kinds its own reads name, and no field (test)"
  - "Where every kind a view reads is kept from its seat, the host does not start it and draws the host's signIn line, or that nothing here is shown (test)"
  - "graview-worker-view, graview-view-drawing and graview-sight say the shape"
touches:
  - "c45e1f45-05e1-4570-82c7-7d2893fa8dbf"
priority: "medium"
tags:
  - "graview"
  - "guest"
  - "hq:feature:f-view-knows-what-its-seat-cannot-see"
source: "Graview HQ feature:f-view-knows-what-its-seat-cannot-see"
---
