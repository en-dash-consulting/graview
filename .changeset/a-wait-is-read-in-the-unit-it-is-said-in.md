---
"@graview/ship": patch
---

A busy host's wait is read in the unit it is said in (FR-45). A 429 from `POST /graview/ops` says how long to wait twice: the `Retry-After` header, in seconds as HTTP says, and a JSON `retryAfter` that ship documents in milliseconds. `openRemote` read the JSON first, so a host that put seconds there too — Graview Cloud's room said `retryAfter: 2` — was asked again two milliseconds later, a hundred times a second. Now the header is read as HTTP says, delta seconds or an HTTP date; the JSON as milliseconds, the finer word; and a JSON wait under 50 beside a header saying the same number of seconds is taken for seconds said in the wrong place, and the header wins. Ship's own handler, which says a short wait as 30 in the body and 1 in the header, is read as the 30 ms it means. The README says the units loudly.

Compatibility: the wire — unchanged; `retryAfter` is milliseconds wherever ship says it, and `Retry-After` seconds, as before. A host that said seconds in the JSON body is now waited for in seconds when its header agrees. Ops, presence, stored formats and check codes are unchanged.
