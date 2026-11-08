---
id: "817e602c-bac9-4773-afd0-9541eacfc85f"
type: "change"
title: "0.1.51: Several people type into one long text field at once and keep every word: over the wire, in the editor, in words, whatever the network does."
slug: "release-0-1-51"
intent: "What 0.1.51 shipped, recorded after the release from its entry in apps/site/releases.json. The work itself was tracked on the Graview Roadmap app."
acceptanceCriteria:
  - "Over the wire. `remote.typing(node, field)` sends a field's typing a run at a time as `type-text`, and the server carries each run over everyone else's, so two pages typing into one field both keep their words, over the socket or the poll. A reader that never said it reads op format 3 is sent the whole text instead of a splice. `@graview/core/typing` loads the first time somebody types."
  - "In the editor. Prose the declaration types together opens with no draft and no Save: each keystroke is the field's at once, somebody else's typing lands as it arrives with the selection carried over it, and Ctrl or ⌘ Z takes back only this person's own last run. Presence carries a caret."
  - "In words. A run of typing is said as what it wrote, where and how much (\"Ada wrote in Kitchen's notes (+42 −3)\"): one tick in the timeline, one row in Activity with one undo, one notification when the typist stops, and `historyInWords` for an agent's history."
  - "Whatever the network does. A seeded fuzz of three pages typing, with frames held, duplicated and lost and runs taken back at random, found five ways an undo of typing went wrong; all are fixed."
shippedIn: "0.1.51"
tags:
  - "backfill"
  - "0.1.51"
source: "apps/site/releases.json"
---
