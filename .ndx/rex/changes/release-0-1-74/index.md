---
id: "c1cb3010-d6ff-4e55-bd55-2f462d43f74f"
type: "change"
title: "0.1.74: Any place drawn for an e-ink screen with what each press does; a bare app that looks designed, and a home proposed from the declaration; templates that ask a time and bring their views; a field that keeps a time of day; and a host asks whether a seat may run an act without running it."
slug: "release-0-1-74"
intent: "What 0.1.74 shipped, recorded after the release from its entry in apps/site/releases.json. The work itself was tracked on Graview HQ and in the seven changes it completed."
acceptanceCriteria:
  - "**An e-ink screen.** `@graview/pages/device` draws any place for a reader on a wall (a Kindle Paperwhite 3 upright is 758 \u00d7 1024): sixteen grays, no motion, type at 20 px or more and presses at least 64 px, pages that turn at the foot. `taps` says what each region does, and `resolveTap` does it as the seat that tapped, refusing anything the screen it was tapped on did not offer."
  - "**An app says which places a device offers.** `devices: { screens: [{ place, label }] }` names the strip along a device's foot; `graview check` holds each to a real place and 12 characters, and a screen follows its place when it is renamed."
  - "**A bare app looks designed.** With nothing declared, a glance leads with the kind's date said as people say it, naming the zone only to a reader on another clock. The home says the app's description once. Every warning carries its mark and its words, never its color alone."
  - "**A home from the declaration.** `composeDesign` proposes what a plain document lacks \u2014 a home of a count and a list per kind, and a row and a glance per kind with its date and status \u2014 and keeps what is declared. The new formatter `{x | glance}` says a moment as a glance does."
  - "**Templates ask a time and bring views.** A question may be a `time`; setup words may say `${id}`; a template may carry `views` and `frameViews`, which `graview create --template` writes beside the project. `graview check template.json` checks the template too."
  - "**A time of day.** A field may be `{ \"type\": \"time\" }`, kept as `HH:MM`, typed in a time input and read from \"3 PM\"."
  - "**May this seat run this?** `mayRun` and `mayRunEach` on `@graview/core/seat` answer allowed, what is left to fill, or refused with the rule and the words, writing nothing. Applying and asking now judge through one path."
  - "Security and reliability fixes."
shippedIn: "0.1.74"
tags:
  - "release"
  - "0.1.74"
source: "apps/site/releases.json"
---
