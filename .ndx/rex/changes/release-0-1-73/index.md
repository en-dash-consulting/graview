---
id: "b61603ac-13e7-437c-9098-4d8e920902cf"
type: "change"
title: "0.1.73: A visitor's view is no longer stopped by the host's link check; a view knows what its seat can't see, is checked as every seat, and fails a part at a time; a view loads its own face; a joining member becomes the person already entered; and a home view's pictures load lazily and small."
slug: "release-0-1-73"
intent: "What 0.1.73 shipped, recorded after the release from its entry in apps/site/releases.json. The work itself was tracked on Graview HQ and in the nine changes it completed."
acceptanceCriteria:
  - "**A visitor's view draws.** A home view of many linked records that drew for its owner and stopped for every signed-out visitor now draws for both: what a seat is kept from is worked out once per seat, not once per link. A home view that does stop falls back to the app's built-in home and stays there."
  - "**A view knows what its seat can't see.** A worker view is handed `props.unseen` — the kinds it reads that the seat sees none of, and the fields sight may keep from it — so it can say \"Sign in to see the vendors\". A view whose seat sees nothing it reads is not started; the host's sign-in is drawn in its place."
  - "**A view is checked as every seat.** `graview view check --seats` runs a view as its owner, as each role and as a visitor, and says for each whether it drew, fell back or was stopped."
  - "**A part of a view fails alone.** `graview.part(name, draw)` marks a part; one that throws or runs long is drawn as a small note, and the rest of the view still draws."
  - "**A view loads its own face.** A worker view's stylesheet may declare an `@font-face` from a `data:` font, up to 50 KB a face and 200 KB a view, drawn in that view alone."
  - "**A joining member is the person already entered.** `bindPerson` on `@graview/core/binding` binds the joining account to an existing record of the people kind, so `$me`, grants, acts and Activity are that record and no second person is made."
  - "**Pictures load lazily and at the size each use needs.** An `<img>` in a view takes `loading` and `fetchpriority`, and `pictures: { thumb }` hands a smaller copy beside `src`. `bleed: \"full\"` is said in the skills and the manifest check."
  - "**A district's records with no value share one row**, so adding one moves no other block."
shippedIn: "0.1.73"
tags:
  - "release"
  - "0.1.73"
source: "apps/site/releases.json"
---
