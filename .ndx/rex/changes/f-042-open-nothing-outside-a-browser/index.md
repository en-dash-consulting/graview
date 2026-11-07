---
id: "51bbef5a-04e7-4654-ac01-8971c6708716"
type: "change"
title: "F-042 · Open — nothing outside a browser can see what is drawn, and no app can fix it"
slug: "f-042-open-nothing-outside-a-browser"
intent: "Every graview describe run ends by asking for defineApp({ views }). No app can pass one: the registry is React and the declaration lives in the domain tier, which the skills forbid React in. Suggest a --views ./dist/ui/views.js flag, or reword the note so it stops reading as neglect."
touches:
  - "249fdeb3-a528-42c5-bfab-caaf9b856504"
priority: "medium"
---
