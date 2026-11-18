---
id: "9186c86b-b313-44ba-941e-4dbe9a879a6e"
type: "change"
title: "0.2.6: A rule reads the day in the app's own time zone, an owner can move a person bound to the wrong record to the right one, and a board's title on the one face breaks only between words."
slug: "release-0-2-6"
intent: "What 0.2.6 shipped, recorded after the release from its entry in apps/site/releases.json. The work was tracked on Graview HQ and in the changes of the same names: f-today-in-the-apps-zone (#642), f-linked-project-takes-checkout-react-types (#643), f-rebind-after-acting (#644), f-board-titles-break-between-words and f-removed-record-comes-down-when-slow (#645); batch #647."
acceptanceCriteria:
  - "**A rule's day is the app's own**: `today()` and `date()` read the declared `brand.timeZone`."
  - "**An owner can put a binding right**: `rebindPerson` from the host's own seat, one undoable change."
  - "**A board's title breaks only between words**, and a removed record comes down on a slow machine."
  - "A linked project takes React's types from the checkout."
  - "Security and reliability fixes."
shippedIn: "0.2.6"
source: "apps/site/releases.json"
tags:
  - "release"
  - "0.2.6"
---
