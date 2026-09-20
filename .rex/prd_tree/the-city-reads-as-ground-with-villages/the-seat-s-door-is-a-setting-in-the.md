---
id: "88aa5fd4-5509-4a67-b18e-2969171b2358"
level: "task"
title: "The seat's door is a setting in the profile, not a pane of prose over the map"
status: "pending"
priority: "high"
tags:
  - "interface"
  - "chat"
  - "intelligence"
  - "profile"
source: "Nick's Squad screenshot, 2026-09-19: the \"SEAT on-device\" pane open over the city, clipped at the bottom"
acceptanceCriteria:
  - "The chat panel has no settings pane; its gear is gone"
  - "The profile pane has one setting \"Answers come from\" with four short options, the current rung pressed, and a key field only when a rung needs one"
  - "Nothing about the rung is more than one sentence on screen; the rest is a tooltip"
  - "chat, seat, who and audit harnesses pass; unit tests cover the setting and the chat's use of it"
description: "The chat's gear (chat.tsx ~540-600) opens a pane on the map: a heading \"SEAT on-device\", four radio rungs each with a paragraph, a TypeSafe key field with a placeholder about the dev server's door, and three more sentences about where the key goes — clipped at the bottom of the window, covering a third of the city and the screen. That is configuration written as documentation, floating over the picture. Move it: the rung becomes ONE reader setting in the profile pane beside text size and scheme — title \"Answers come from\", options as four short labels (\"this graph\", \"on this device\", \"Jev, which decides\", \"a model, with my key\") — using the SettingDeclaration machinery (rememberSetting; the value is the IntelligenceConfig.source) so it is the same control as every other setting. The key is a small password field under that setting, shown only when \"a model\" or \"Jev\" is chosen, with a six-word hint (\"kept in this browser, sent only there\") and a \"?\" that opens the existing docs sentence in a tooltip rather than printing it. The chat panel loses its gear and settings entirely: it is a conversation. The rung's honesty sentence stays in the reply where it already is. The Door in seeding.tsx (the dev-server decision door status) shows as one line in the same block, not a card. Harnesses: chat, seat, who, audit (no pane over the stage; no clipped text). Tests: the chat panel renders no radio group; the profile renders the setting with the current rung pressed; choosing a rung changes the provider the chat uses."
lastModified: "2026-09-20T03:45:53.800Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
