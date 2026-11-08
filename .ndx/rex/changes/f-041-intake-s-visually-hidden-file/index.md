---
id: "6ed73bda-0580-4fa7-96f1-3d4079073b2f"
type: "change"
title: "F-041 · <Intake>'s visually-hidden file input is a 1x1 target with a 1x1 focus ring"
slug: "f-041-intake-s-visually-hidden-file"
intent: "Caught by Groundskeeper's audit-ui on four screens. The input is inside a label and the label is four rem tall, but the input is still focusable and still a control. Stretched over the box at zero opacity instead: native picker kept, drop zone kept, target the size of the box."
touches:
  - "249fdeb3-a528-42c5-bfab-caaf9b856504"
priority: "medium"
---
