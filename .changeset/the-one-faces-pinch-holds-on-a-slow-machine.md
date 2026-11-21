---
"@graview/pages": patch
"@graview/react": patch
---

The one face's pinch holds on a slow machine. On a CPU four times slower than a laptop's, the view takes a zoom or a pan someone let go of a frame or more after their next gesture has begun, and two things went wrong. At Nearby, the second turn of a pinch over the city drew a line's end tens of pixels off its building until the hand let go. On a phone at the Map, a pinch let go of with a pan straight after slid every board 1 to 3 pixels a frame off its district. Now:

- the Scene keeps the offset a hand has made since it let go painted when the view takes the earlier one (`useWorldShift`), where it used to take the whole transform off until the hand moved again;
- the one face reads the city again when it is laid out anew under a hand's offset, and carries what it drew along with what the districts say moved;
- a stall in the frames no longer counts as time the hand was off the city, so a zoom is never placed while the finger that starts the pan is still waiting to be heard.

Held by one-face's `atNearbyAPinchOverTheCityZoomsItAndThePanelAndTheLevelStay` and `duringAPinchThatPansEveryBoardAndNameStaysFastenedToItsDistrictEveryFrame`, under `GRAVIEW_SLOW=4` and on the GPU leg.

Compatibility: the wire, stored formats, ops and primitives, derived tool names and input schemas, and the declaration and check finding codes are unchanged. What Graview Cloud does: nothing.
