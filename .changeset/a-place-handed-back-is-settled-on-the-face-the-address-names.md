---
"@graview/embed": patch
---

Under address routing, a place handed back to the embed is settled on the face the address names (FR-106, FR-116). `mount(…, { at })` already opened on the face in the address bar, but it settled the place as if it were on the face `at` said. A host that remounts after a reload with the `at` it read earlier can hand back the scene while the address names a page. The page in the address was then left unsettled, so a record since removed showed as missing instead of falling back to its kind's list. The scene's stop was also written onto the page's address as a fragment. The address now decides the face as well as the place, and a page it names is settled like any other.

Compatibility: unchanged for ops, stored formats, the wire, the declaration and check finding codes, and tool schemas.
