---
id: "1b5ca7a1-e785-44c9-ba5b-191e85294744"
type: "capability"
title: "The overview's address means the overview without its fragment (FR-154)"
slug: "the-overview-s-address-means-the"
statement: "The overview's address, /places/overview with no fragment, opens the overview at altitude on the Shell, embed and hosted page, and a fragment that already says where it stands is respected."
criteria: [{"id":"c1","text":"When the address is /places/overview with no fragment, the Shell shall open the overview at altitude."},{"id":"c2","text":"When the address is /places/overview with no fragment, the embed shall open the overview at altitude."},{"id":"c3","text":"When the address is /places/overview with no fragment, the hosted page shall open the overview at altitude."},{"id":"c4","text":"If an address carries a fragment that already says where it stands, the framework shall respect that fragment."},{"id":"c5","text":"The framework shall write the overview's address so that it means the overview without needing a fragment."}]
tags:
  - "graview-cloud"
  - "FR-154"
  - "address"
  - "scene"
source: "Graview Cloud, 2026-10-10 (the framework brief after 0.1.20, ../graview-cloud/docs/framework-brief-0.1.21.md)"
priority: "high"
resolution: "Fixed in #191: a bare /places/overview opens at altitude, the framework writes the overview without a fragment, and an old #overview=1 link is tidied in place."
---

The framework writes the overview as /places/overview#overview=1 and reads altitude from the fragment alone. A fragment never reaches a server, so the same address back through a sign-in door, a stored link or a bookmark opened the overview place descended on nothing: an empty scene whose control says Up. Cloud carries INTERIM(FR-154) restoreOverview in packages/client/src/shell.ts.
