---
id: "52c4fc82-0af0-443c-9cf9-d00a97432769"
type: "change"
title: "The graview button toggles — 'Graview' up, 'Focus' down — and its mark morphs to say so"
slug: "the-graview-button-toggles-graview-up"
intent: "The altitude control currently reads one-way. It should present as the toggle it is: labelled 'Graview' from the ground (the place it takes you) and 'Focus' from altitude (the way back down), with aria state staying honest. The SVG mark should MORPH inline between its two states rather than swapping — riding the same 640ms altitude easing the scene's own morph rides, so the control and the scene agree about the change — and degrade to a clean cut where the scene's morph does (@property-less engines). Coverage: the navigation or direct harness asserts the label and mark state in both altitudes."
acceptanceCriteria:
  - "The control's visible label reads 'Graview' at ground level and 'Focus' from altitude, and aria-pressed/aria-label stay consistent with it"
  - "The SVG mark morphs inline between its two states — same duration and easing as the scene's altitude morph — rather than being swapped"
  - "Where the scene's morph degrades to a cut (no @property), the mark cuts cleanly too — verified, not assumed"
  - "A harness (navigation or direct) asserts label and mark state in both altitudes"
touches:
  - "cb0397c2-9baa-4e06-8f61-2f0c22b94c97"
priority: "medium"
---
