---
id: "80b0b665-b1ea-4ebe-8a0d-2c84513a3ddf"
level: "feature"
title: "The seat takes you where you ask"
status: "completed"
priority: "high"
tags:
  - "seat"
  - "navigation"
source: "Nick, 2026-10-08: \"i want 'the seat' interface changed in both Pages and Scene views. i want it to be more floating and less of a 'heres everything you can do with the selected node' and more open to experiences with less noise (right now the interface is really unclear, all the action names are weird, and so many buttons/options). I want it to help me navigate through the graview app, but also as an additional bit of making it so adaptive, is i want it to be able to generate the uis for me on the fly, quickly, with the ability to save that as a new lens\""
completedAt: "2026-10-09T07:10:05.000Z"
endedAt: "2026-10-09T07:10:05.000Z"
acceptanceCriteria:
  - "Asking for a place, a record, a picture or a question ('show me the deliverables due this week', 'go to Ongoing support', 'what's blocking the workshop?') moves the app there: Scene or Pages, the place, the record in focus, what's in view — through the same addresses and steps the bar uses (withPicture, places, where())"
  - "Each move is undoable with Back and said in a sentence; the seat answers from the graph without a model where it can (search, places, describe) and uses the app's intelligence provider only when it must"
  - "Works under the seat's own sight: it never offers or reveals what the seat may not see"
description: "Nick: 'I want it to help me navigate through the graview app'."
lastModified: "2026-10-09T03:01:47.610Z"
resolution: "Shipped in #166 and #169: @graview/tools/go resolves places, records, kinds with a date or status, problems and describe without a model under the seat's sight; moves applied on both faces, Back undoes, said in a sentence; verify-seat-goes-and-draws."
---
