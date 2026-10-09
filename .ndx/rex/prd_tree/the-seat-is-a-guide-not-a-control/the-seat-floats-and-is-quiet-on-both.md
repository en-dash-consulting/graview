---
id: "95e83cbe-8d35-4654-a176-8250b5cd9c30"
level: "feature"
title: "The seat floats and is quiet, on both faces"
status: "completed"
priority: "critical"
tags:
  - "design"
  - "a11y"
  - "seat"
source: "Nick, 2026-10-08: \"i want 'the seat' interface changed in both Pages and Scene views. i want it to be more floating and less of a 'heres everything you can do with the selected node' and more open to experiences with less noise (right now the interface is really unclear, all the action names are weird, and so many buttons/options). I want it to help me navigate through the graview app, but also as an additional bit of making it so adaptive, is i want it to be able to generate the uis for me on the fly, quickly, with the ability to save that as a new lens\""
completedAt: "2026-10-09T07:10:05.000Z"
endedAt: "2026-10-09T07:10:05.000Z"
acceptanceCriteria:
  - "On the scene and on Pages the seat is one floating surface over the app, not a docked panel or a column of controls: closed it is a small presence; open it is a conversation-first panel that can be moved aside and never pushes the page"
  - "Opened with nothing asked, it offers a few plain suggestions in the reader's words drawn from where they are (what's here, what's wrong, where to go next) — not every act on the selected record"
  - "Acts are said in the declaration's words for people (labels, not ids or mutation names like 'Take a topic out of this part …'); at most three are offered at once, chosen by relevance, the rest reachable by asking"
  - "The same seat on both faces, keeping its conversation and state across a switch between Scene and Pages"
  - "pnpm verify: no machine words shown in the seat, at most three suggested acts visible, the page doesn't move when it opens, keyboard and screen reader reach every part, both faces in three engines"
description: "Today the seat ('THE SEAT', 'IN VIEW', 'What's wrong? / Tell me about … / What is here?', a stack of act buttons with odd names) reads as everything you can do with the selected node. Nick finds it unclear and noisy."
lastModified: "2026-10-09T03:01:47.610Z"
resolution: "Shipped in #167: one quiet ask field on both faces; the open panel overlays without moving the page; at most three acts (repairs and pins) and three suggestions in people's words; the conversation held by the provider; the rail, act stack, eyebrows and pills removed; verify-seat-guide in three engines."
---
