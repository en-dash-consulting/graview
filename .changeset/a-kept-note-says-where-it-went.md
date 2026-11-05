---
"@graview/core": patch
"@graview/primitives": patch
---

The answer card's kept note says where it went. A 👎's "What should it have done?" answered "Kept, to learn from.", which said nothing about who reads it, while Graview Cloud also files the note as the person's feedback. A told store now carries `keptSays`, the sentence the card says once the note is kept ("Sent to Graview. You'll find it with your feedback."), and `toldOver(url, { keptSays })` sets it on the wire's store. Unsaid, the card says "Kept, to learn from." as before.

The unit test `a-kept-note-says-where-the-host-sent-it` holds the host's sentence once the note is kept, and the old one when the host names nowhere.

Compatibility: the look — unchanged unless a host says `keptSays`. The JavaScript API — new, optional: `ToldStore.keptSays` and `toldOver`'s `keptSays` option. Ops and primitives — unchanged. Stored formats — unchanged. The wire — unchanged. The declaration and check finding codes — unchanged. Derived tool names and input schemas — unchanged.

What Graview Cloud does: hand `HostAi.told` a store with `keptSays: "Sent to Graview. You'll find it with your feedback."`.
