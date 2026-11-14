---
"@graview/pages": patch
---

The one face places and routes knowing that the city's side is narrow and which gaps hold words. Four things 0.2.1 left:

- At Nearby on Deep Time's Solnhofen at 1280×800 the Tree of life had no board: the Dig map, standing over the species district behind its own, had taken the only room there. Beside a page the app's views now stand before the kinds' own lists, the district with least room over its back first, so a view whose district is in sight keeps its board.
- On the home at Nearby on a 360×640 phone the city sat about 26 pixels off the middle of its strip: the districts the home's views show fitted there on their own, and the framing fitted them and never came back to the whole city. Now it frames them at that zoom and brings the city as near the middle of its side as they let it.
- On a phone a page's lines left the sheet straight up across the rows above. Now, as on a desk, a line whose straight way would cross another part drops into the gap above or below its row, runs along it to the sheet's side, and goes up that side, inside the sheet's margin, to its top edge.
- In a view (a worker view, a frame) the page cannot read the words between its records, and on Graview Cloud's Family tree the lines from a pill row rose into the paragraph above it and drew a box through the text. A line in a view now takes the gap below its row first and keeps to the row's own spacing, never a gap that may hold words; on a phone it never goes straight up through them.

Tests: `verify-frame-lines` holds that inside the panel no line crosses another pill, a row or the paragraph between a link and the pills, on a desk and on a phone. `verify-one-face` holds that every view of a district in sight has a board at Nearby and that the home's city is as near the middle as its views' districts allow, at every size. A unit test places what the one face asked at 1280×800 and finds every view's board. The every-face bundle budget is raised by 1.2 kB minified (0.5 kB gzipped) for it.

Compatibility: the look — changed on the one face only (`sceneUnderPages`): beside a page a kind's list board may give its place to a view's, the home's Nearby may stand the city nearer the middle on a small phone, and lines inside the panel take other gaps on a phone and in a view. The JavaScript API — unchanged. Ops and primitives — unchanged. Stored formats — unchanged. The wire — unchanged. The declaration and check finding codes — unchanged. Derived tool names and input schemas — unchanged.
