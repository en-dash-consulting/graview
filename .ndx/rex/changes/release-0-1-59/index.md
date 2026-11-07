---
id: "4b29284b-d1c0-44da-abc5-79e39b1878c4"
type: "change"
title: "0.1.59: A security release: a served store and a dev server answer only their own page, the store judges every undo, merge and keystroke as the act it is, and nothing a seat may not see reaches it sideways."
slug: "release-0-1-59"
intent: "What 0.1.59 shipped, recorded after the release from its entry in apps/site/releases.json. The work itself was tracked on the Graview Roadmap app."
acceptanceCriteria:
  - "A served store on loopback believes only its own page. `graview serve` keeps to its own origin and host, answers no wildcard CORS while it trusts seat headers (`--allow-origin` names an origin that may), reads `x-graview-kind: system` as a person unless `--trust-seat-headers` is given, holds a body to 16 MiB before routing, and caps a live socket's fragments."
  - "A dev server's doors ask for a key. The studio, local, model, decision, files and views doors answer only a page opened from the address the dev server prints, which trades a key kept in `~/.graview/door-key` for a cookie only its own pages send; a page opened at the plain address is told its doors are closed. The local `claude` bridge reads only its own folder."
  - "The store judges what a change is. An undo of an undo is judged as the act it puts back, and a change no act made is taken back only by its maker, the system or a seat granted every act; what a page offers to take back is what the store would take back. A merge and a kept link ride the making of a kind only over what the seat made; a keystroke rides an act only while that act could run; a split takes only what the kind's edit takes."
  - "Nothing hidden leaks sideways. A record withheld whole refuses like an absent one, ids are never minted from a kept field or reused from the log, the app's own actor's suggestions say nothing a seat's sight keeps and a planted duplicate steers no merge, and a seat acting for a person reads another app as that person."
  - "Data never becomes code. A template's title and the studio's write-back are written as text, a kind's figure is judged where it is drawn, and a typeface or scoped theme stays in its box."
shippedIn: "0.1.59"
tags:
  - "backfill"
  - "0.1.59"
source: "apps/site/releases.json"
---
