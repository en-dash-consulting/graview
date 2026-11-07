---
id: "95e83cbe-8d35-4654-a176-8250b5cd9c30"
type: "capability"
title: "The seat floats and is quiet, on both faces"
slug: "the-seat-floats-and-is-quiet-on-both"
statement: "On both the scene and Pages, the seat is one floating, conversation-first surface that offers a few plain suggestions and at most three acts at once, said in the declaration's words for people."
criteria: [{"id":"c1","text":"On the scene and on Pages, the seat shall be one floating surface over the app, not a docked panel or a column of controls."},{"id":"c2","text":"While the seat is closed, it shall appear as a small presence over the app."},{"id":"c3","text":"While the seat is open, it shall present a conversation-first panel that can be moved aside and never pushes the page."},{"id":"c4","text":"When the seat is opened with nothing asked, it shall offer a few plain suggestions in the reader's words, drawn from where the reader is (what is here, what is wrong, where to go next), rather than every act on the selected record."},{"id":"c5","text":"The seat shall say acts in the declaration's words for people (labels), not as ids or mutation names."},{"id":"c6","text":"The seat shall offer at most three acts at once, chosen by relevance, and shall leave the rest reachable by asking."},{"id":"c7","text":"The seat shall be the same on the scene and on Pages, keeping its conversation and state across a switch between the two faces."},{"id":"c8","text":"The seat shall be reachable in every part by keyboard and by screen reader on both faces."}]
tags:
  - "design"
  - "a11y"
  - "seat"
source: "Nick, 2026-10-08: \"i want 'the seat' interface changed in both Pages and Scene views. i want it to be more floating and less of a 'heres everything you can do with the selected node' and more open to experiences with less noise (right now the interface is really unclear, all the action names are weird, and so many buttons/options). I want it to help me navigate through the graview app, but also as an additional bit of making it so adaptive, is i want it to be able to generate the uis for me on the fly, quickly, with the ability to save that as a new lens\""
priority: "critical"
resolution: "Shipped in #167: one quiet ask field on both faces; the open panel overlays without moving the page; at most three acts (repairs and pins) and three suggestions in people's words; the conversation held by the provider; the rail, act stack, eyebrows and pills removed; verify-seat-guide in three engines."
---

Today the seat ('THE SEAT', 'IN VIEW', 'What's wrong? / Tell me about … / What is here?', a stack of act buttons with odd names) reads as everything you can do with the selected node. Nick finds it unclear and noisy.
