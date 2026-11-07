---
id: "80b0b665-b1ea-4ebe-8a0d-2c84513a3ddf"
type: "capability"
title: "The seat takes you where you ask"
slug: "the-seat-takes-you-where-you-ask"
statement: "The seat takes a person to the place, record, picture or question they ask for in the app, using the same addresses and steps the bar uses."
criteria: [{"id":"c1","text":"When a person asks the seat for a place, a record, a picture or a question, the seat shall move the app there, setting Scene or Pages, the place, the record in focus and what is in view through the same addresses and steps the bar uses (withPicture, places, where())."},{"id":"c2","text":"When the seat moves the app, the seat shall make the move undoable with Back."},{"id":"c3","text":"When the seat moves the app, the seat shall say the move in a sentence."},{"id":"c4","text":"Where the graph can answer a request (search, places, describe), the seat shall answer it from the graph without a model."},{"id":"c5","text":"If the graph cannot answer a request, the seat shall use the app's intelligence provider."},{"id":"c6","text":"While the seat navigates, the seat shall offer and reveal only what the seat may see."}]
tags:
  - "seat"
  - "navigation"
source: "Nick, 2026-10-08: \"i want 'the seat' interface changed in both Pages and Scene views. i want it to be more floating and less of a 'heres everything you can do with the selected node' and more open to experiences with less noise (right now the interface is really unclear, all the action names are weird, and so many buttons/options). I want it to help me navigate through the graview app, but also as an additional bit of making it so adaptive, is i want it to be able to generate the uis for me on the fly, quickly, with the ability to save that as a new lens\""
priority: "high"
resolution: "Shipped in #166 and #169: @graview/tools/go resolves places, records, kinds with a date or status, problems and describe without a model under the seat's sight; moves applied on both faces, Back undoes, said in a sentence; verify-seat-goes-and-draws."
---

Nick: 'I want it to help me navigate through the graview app'.
