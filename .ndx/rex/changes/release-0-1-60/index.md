---
id: "ca7dc565-ca5c-4324-8bc1-2785932339bb"
type: "change"
title: "0.1.60: A loopback serve and preview believe a seat only with the run's key; typing and Edit ride an act only where it would run; compaction moves past old publishes, and an older build refuses what it would misread."
slug: "release-0-1-60"
intent: "What 0.1.60 shipped, recorded after the release from its entry in apps/site/releases.json. The work itself was tracked on the Graview Roadmap app."
acceptanceCriteria:
  - "A run's key on loopback. `graview serve`, `graview preview` and `graview shots` mint a key each run and say it only in the addresses they print; without it every route but health answers 401, the live wire too. Open the printed address once and the page holds a cookie; `openRemote`, `graview mcp --remote-url` and `graview apply --remote-url` take the printed address whole. `GRAVIEW_SERVE_KEY` sets the key for a harness."
  - "Typing and Edit ride an act only where it would run. A keystroke into a field a TypeScript act writes is accepted only where that act would run on the record, and no Edit is offered where it would not; `graview check` warns `typing-act-without-allowed-on` where it cannot ask faithfully."
  - "One rule for ids and sight. A day of a repeating series split or detached mints its id by the same kept-field rule as every act and import, and a sight names a field as the kind spells it (`startsAt`)."
  - "Compaction moves past old publishes. A checkpoint keeps what readers were served at each publish they may be served again, so an app that publishes rarely compacts as often as any; a store compacted past its standing publish is snapshot format 2, which 0.1.59 refuses rather than misread."
  - "A host reads that 0.1.59 shipped the import and tidying fixes Graview Cloud's audit asked for, in `capabilities().shipped`."
shippedIn: "0.1.60"
tags:
  - "backfill"
  - "0.1.60"
source: "apps/site/releases.json"
---
