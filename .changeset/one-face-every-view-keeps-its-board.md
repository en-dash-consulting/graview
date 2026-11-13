---
"@graview/pages": patch
---

Beside a page, a view whose district is in sight keeps its board more often, and a post that crosses a board is judged where it is seen. With the wider panel a desk's Nearby has less city beside it, and a view's board with no clear place over its district stood nowhere; now it is drawn smaller, down to its floor (`boardLeast`) or half its size, and may stand higher over its own district before it stands nowhere, and a district any of which is seen keeps its views' boards. The city says whether the whole of it stands beside the home at Nearby (`data-graview-nearby-holds-the-city`), so a reader of the page can tell a city that cannot fit from one framed badly.

Tests: `verify-one-face` holds that the home at Nearby frames the whole city beside the page, or where it cannot, the districts its views show on the city's side, nothing said under the page, and the city as near the middle as that allows; that a post crosses a board only under it, judged where the crossing is in the window; and that a view whose district is in sight has a board beside a page.

Compatibility: the look — changed on the one face only (`sceneUnderPages`): beside a page a view's board may be drawn smaller or higher over its district rather than not at all. The JavaScript API — unchanged. Ops and primitives — unchanged. Stored formats — unchanged. The wire — unchanged. The declaration and check finding codes — unchanged. Derived tool names and input schemas — unchanged.
