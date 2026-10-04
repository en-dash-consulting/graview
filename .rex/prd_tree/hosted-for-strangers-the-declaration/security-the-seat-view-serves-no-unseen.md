---
id: "ea56f164-32fc-4946-a195-c2358b27a4cc"
level: "feature"
title: "SECURITY: the seat view serves no unseen record's id, in field values, primitives, reads, writes or args (FR-55)"
status: "pending"
priority: "critical"
tags:
  - "graview-cloud"
  - "FR-55"
source: "Graview Cloud FR-55, 2026-10-03 (brief after 0.1.3)"
acceptanceCriteria:
  - "For any graph, history, sights and seat (Cloud's 1,000-world property test from packages/room/tests/sights.test.ts, ported to seenBy, logSeenBy and the live wire), no string that is an unseen record's id appears anywhere the seat is served"
  - "A seen record whose field names an unseen one is withheld or has that field cleared, and the changeset says which"
  - "A withheld op keeps no unseen id in any primitive; reads, writes and args likewise"
  - "graview serve, liveProtocol/createStoreHandler and createMcpHttpHandler all serve through the fixed seat view"
  - "FR-55 is in capabilities().shipped only once the ported property test passes"
description: "seenBy and logSeenBy drop records a seat may not see but leave their ids in seen records' field values and in withheld ops' primitives. Ids are minted from labels, so this tells a viewer the hidden record's name."
lastModified: "2026-10-04T01:45:11.000Z"
---
