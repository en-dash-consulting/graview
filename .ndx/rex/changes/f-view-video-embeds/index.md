---
id: "4224618e-2383-457f-b524-c27e6778020b"
type: "change"
title: "A view plays a YouTube or Vimeo video inline, in a player the host draws"
slug: "f-view-video-embeds"
intent: "From HQ feature:f-view-video-embeds: A view names a video by its provider and id or address and the host draws the player; a view gets no raw iframe. Providers are a closed list (YouTube's no-cookie player, Vimeo's player); the host builds the address from a checked id. A poster and a play button come first and nothing is fetched from the provider until play. A fixed shape, the keyboard and a screen reader reach it, a link out stays, a host may switch providers off."
acceptanceCriteria:
  - "A view's YouTube and Vimeo videos play in place against stubbed players in three engines, with no provider request before play (harness claim)"
  - "An address outside the list is refused, and the checker says so (test)"
  - "A host that turns a provider off draws the link alone (test)"
priority: "high"
tags:
  - "graview"
  - "guest"
  - "react"
  - "core"
  - "hq:feature:f-view-video-embeds"
source: "Graview HQ feature:f-view-video-embeds"
---
