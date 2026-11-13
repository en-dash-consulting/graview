---
"@graview/core": patch
"@graview/guest": patch
"@graview/pages": patch
"@graview/skills": patch
---

On the one face, a view drawn where the page cannot read has its lines to the city. At Nearby a built-in page draws a line from each record it shows to that record's building; a worker view and a frame guest drew none, so a page made of them floated beside the city tied to nothing. Now each element a view marks with `data-record`, the mark a link to a record already is, has its line, on the element as it is drawn while the page scrolls and as it moves a level. A frame guest's client (`GraviewGuest.connect`, `@graview/guest/client.js`) says which records it marks, and the host draws lines from them. A record page drawn by a view that marks nothing still has one line, from the view to its record. Where a view is a record's whole page, what the record is connected to is said at the top, small, so a tall view no longer hides it below the fold; and at Nearby the camera stands back, no further than it must, to take in the buildings a record's page is connected to. The `graview-view-links` skill says what draws a line. Security and reliability fixes.

Compatibility: the look is unchanged except where the one face (`sceneUnderPages`) draws a worker view or a frame guest, which now has lines, and a record's Nearby, whose camera may stand further back. The JavaScript API is additive (`@graview/core/record-boxes`, a new entry; `GuestHostOptions.onRecords`, `GuestHost.handed` and `GuestLimiter.records` on the guest host; `GuestRecordBox` on `@graview/guest`). Ops and primitives are unchanged. Stored formats are unchanged. The wire is additive: a frame guest may send `{ type: "records", nonce, boxes, shows }`, which a host that draws no lines drops unread. The declaration and check finding codes are unchanged. Derived tool names and input schemas are unchanged.
