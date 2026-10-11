---
id: "e4755019-ddc3-425d-bebd-3365463d932d"
level: "feature"
title: "describe_place in a host turn knows the app, so it describes lens places"
status: "completed"
priority: "high"
startedAt: "2026-10-11T18:20:00.000Z"
completedAt: "2026-10-11T18:20:00.000Z"
endedAt: "2026-10-11T18:20:00.000Z"
tags:
  - "n-dx"
  - "seat"
  - "sight"
source: "The review round before 0.1.22 (#207), 2026-10-11"
acceptanceCriteria:
  - "The chat hands the turn's tool runtime the app it is mounted with"
  - "describe_place over a host turn describes a lens place as it does over graview mcp"
  - "A test holds it"
description: "Inside a HostAi.turn the chat has no app to hand the tool runtime, so describe_place cannot describe a lens place."
lastModified: "2026-10-11T18:20:00.000Z"
resolution: "Fixed in #213: GraviewProvider holds the app it is mounted with (mount, <Embed> and PagesApp's context pass it), and the chat hands it to its runtime and, as ChatContext.app, to a host's turn, whose describe_place describes a lens place as graview mcp does."
---
