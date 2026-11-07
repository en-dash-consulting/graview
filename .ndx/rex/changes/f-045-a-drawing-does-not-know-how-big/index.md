---
id: "bf9699ba-7a9b-4e48-86e3-73691d98b5d6"
type: "change"
title: "F-045 · A drawing does not know how big it actually is"
slug: "f-045-a-drawing-does-not-know-how-big"
intent: "A scalable drawing hides the question: at THIS size can a person read it, or press it? The scene handed a map panel 136px on a phone; the canvas resolved to 138x2 and escaped, painting names 900px off a 390px screen, every marker a 1x1 target with a keyboard stop and an ARIA label. useDrawnSize in @graview/react answers it; the drawing stops claiming to be a control surface and the list beside it becomes the way in."
touches:
  - "249fdeb3-a528-42c5-bfab-caaf9b856504"
priority: "high"
---
