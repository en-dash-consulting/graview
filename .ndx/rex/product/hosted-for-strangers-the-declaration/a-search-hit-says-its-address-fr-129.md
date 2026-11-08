---
id: "d2fd384e-0bf9-4225-898f-21b14a0518af"
type: "capability"
title: "A search hit says its address (FR-129)"
slug: "a-search-hit-says-its-address-fr-129"
statement: "A search hit carries its own address, the record's or place's path on the routed face, worked out from placesOf."
criteria: [{"id":"c1","text":"A node Hit shall carry an address, which is its record's path on the routed face as addressOf would spell it."},{"id":"c2","text":"A place hit shall carry its place's address."},{"id":"c3","text":"Cloud's cross-app search shall build no path of its own and shall use the address each hit carries."}]
tags:
  - "graview-cloud"
  - "FR-129"
source: "Graview Cloud, 2026-10-07 (brief after 0.1.15)"
priority: "low"
resolution: "Shipped in #129 (0.1.16): a record, kind or place hit carries address under an optional basePath, and a search of the store itself by a seat with an own sight finds only its own records."
---

Cloud works out each hit's path from placesOf itself.
