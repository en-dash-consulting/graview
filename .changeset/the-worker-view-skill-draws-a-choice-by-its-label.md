---
"@graview/skills": patch
---

The graview-worker-view skill says to draw a choice by its label (Roadmap f-skill-choices). A record's enum field holds its option's id, and 0.1.56 hands a view `props.choices` — kind → field → option → label — to say it with, but the skill never said so, so views drew `state-sponsored`. It now says `props.choices.actor.motive[node.motive]`, and in a few words what this release lets a view do: choose the kinds or fields it is handed pictures of (`["circuit"]`, `{ circuit: "photo" }`) within the 12 MB they share, name a `<section>` by its own heading with `aria-labelledby`, and style a disclosure's triangle with `summary::marker` and `::-webkit-details-marker`. graview-view-drawing no longer says a section is never named. Both stay under the skills' 11,000-character limit, the worker view's by tightening its gestures, limits and examples paragraphs.

Compatibility: unchanged for a host and an app — the skills' guidance only; a view written to it uses what 0.1.56 and this release already hand it.
