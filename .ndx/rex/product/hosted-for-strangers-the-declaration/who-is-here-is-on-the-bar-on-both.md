---
id: "f089055d-b38a-4bdf-8dff-78eacd3cd500"
type: "capability"
title: "Who is here is on the bar, on both faces and a phone (FR-155)"
slug: "who-is-here-is-on-the-bar-on-both"
statement: "The AppBar shows who else is on the app, on both Pages and a phone, as a stack of people that opens into a list of names and places."
criteria: [{"id":"c1","text":"The AppBar shall draw who else is here as a stack showing an initial per person on their hue, with agents said as acting for someone and anonymous viewers counted."},{"id":"c2","text":"When the stack is pressed, the AppBar shall list the names of the people here and where each one is."},{"id":"c3","text":"The AppBar shall announce the stack as a polite status to assistive technology."},{"id":"c4","text":"While no one else is here, the AppBar shall not show the stack."},{"id":"c5","text":"The stack shall add no measurable cost to the hosted page's first load, staying within Cloud's 570 KB shell budget."}]
tags:
  - "graview-cloud"
  - "FR-155"
  - "presence"
  - "bar"
source: "Graview Cloud, 2026-10-10 (the framework brief after 0.1.20, ../graview-cloud/docs/framework-brief-0.1.21.md)"
priority: "high"
resolution: "Fixed on bar/places-once-and-who-is-here: the AppBar draws the others from the provider's presence on every face and a phone, lists each by name and where each one is on a press, says it politely and draws nothing when alone; fetched with the bar's panes once somebody is, so the hosted page carries nothing more up front (593,425 bytes, 88 fewer). verify-who's whoIsHereIsOnTheBarOnTheScenePagesAndAPhone, pressedTheBarListsEachByNameAndWhereTheyAre and aloneTheBarDrawsNobodyNotEvenYourOtherTab hold it."
---

Presence was drawn as figures on the scene and nowhere on Pages or a phone, so a reader had no list of who is on the app. Cloud stands a stack under the bar (INTERIM(FR-155) hereStack in packages/client/src/shell.ts).
