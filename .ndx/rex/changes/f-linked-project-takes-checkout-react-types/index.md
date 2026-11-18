---
id: "046dfde3-ca50-43ba-be63-0992572bbb0e"
type: "change"
title: "A project linked to a framework checkout reads React's types from the checkout's own copy"
slug: "f-linked-project-takes-checkout-react-types"
intent: "Found 2026-11-17: csstype 3.2.4 was published and every PR's smoke:create check went red, because a linked project resolved @types/react's csstype fresh while the checkout's lockfile held 3.2.3, and two copies of React's CSS types made src/ui/pages.tsx fail to typecheck. Fixed for now by moving the lockfile (#640). Ask: a linked project takes @types/react and @types/react-dom from the checkout (by path, as it already shares React), so a new csstype or @types/react on npm can't split them again."
acceptanceCriteria:
  - "A linked project's @types/react and @types/react-dom resolve to the checkout's copies (smoke:create claim: aLinkedProjectSharesTheCheckoutsReactTypes)"
  - "With the checkout's lockfile on an older csstype than npm's latest, the linked project still typechecks (smoke:create)"
  - "An installed (not linked) project is unchanged (smoke:create)"
priority: "medium"
tags:
  - "graview"
  - "core"
  - "hq:feature:f-linked-project-takes-checkout-react-types"
source: "Graview HQ feature:f-linked-project-takes-checkout-react-types"
---
