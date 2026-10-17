---
"@graview/primitives": patch
---

"Go to it" on a record's panel beside the map never leaves the keyboard on the page. It went to the record's card once the card was drawn, but until then it stood on `<body>`, and in Chrome on the nightly's loaded runner the card came later than the watch waits. At the press the keyboard now moves to the scene's ground, the one thing the press does not take away, and waits there; the ground is a stop only while it holds the keyboard, and hands it on to the card as soon as the card is drawn.

Compatibility: no surface changes.
