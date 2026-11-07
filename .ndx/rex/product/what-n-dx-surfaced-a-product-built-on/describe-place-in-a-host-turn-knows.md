---
id: "e4755019-ddc3-425d-bebd-3365463d932d"
type: "capability"
title: "describe_place in a host turn knows the app, so it describes lens places"
slug: "describe-place-in-a-host-turn-knows"
statement: "When the chat runs a host turn (HostAi.turn), describe_place describes a lens place the same way it does over graview mcp, because the chat hands the turn's tool runtime the app it is mounted with."
criteria: [{"id":"c1","text":"The chat shall hand the tool runtime of a HostAi.turn the app it is mounted with."},{"id":"c2","text":"When describe_place runs over a host turn on a lens place, the tool runtime shall describe that place as it does over graview mcp."}]
tags:
  - "n-dx"
  - "seat"
  - "sight"
source: "The review round before 0.1.22 (#207), 2026-10-11"
priority: "high"
resolution: "Fixed in #213: GraviewProvider holds the app it is mounted with (mount, <Embed> and PagesApp's context pass it), and the chat hands it to its runtime and, as ChatContext.app, to a host's turn, whose describe_place describes a lens place as graview mcp does."
---

Inside a HostAi.turn the chat has no app to hand the tool runtime, so describe_place cannot describe a lens place.
