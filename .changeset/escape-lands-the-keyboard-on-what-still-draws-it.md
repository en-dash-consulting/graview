---
"@graview/primitives": patch
---

Escape out of a record lands the keyboard on what still draws it. Backing out of a record at altitude took its card away with the keyboard on it, and the keyboard fell to `<body>`: the next Tab went to the zoom buttons in Chromium and elsewhere in WebKit. `BackOut` now notices when the element the keyboard stood on leaves the picture and puts it on the card that holds the record's chip — its district — or, failing that, on a card in the scene (`landTheKeyboard`, exported).
