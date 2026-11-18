---
id: "2f6a925d-cbed-472c-bbb4-1f3ddb8525a9"
type: "change"
title: "The one face holds every claim on a CPU four times slower, and a board leaves the way a building does"
slug: "f-one-face-holds-at-slow-4"
intent: "Found by PR #645, 2026-11-18. Under GRAVIEW_SLOW=4 on GitHub's runner, one-face claims fail, differently each run, on main as well (run 43808997961; runs 44243000975, 44243004726, 44243008089), among them choosingAnythingAtCityLandsAtNearbyAndStays, aRichAppsCityAndNearbyHaveNothingStandingOnAnythingElse, noNameOrTitleIsCutOffOrWrapsAt1280Or390, everyKindsBoardStandsOnItsOwnDistrictEvenWhereThePageCoversOne, noBoardsPostCrossesADistrictsName, letGoOfAZoomEveryBoardAndNameGoesOnFromWhereTheLastFrameDrewIt and duringAPinchThatPansEveryBoardAndNameStaysFastenedToItsDistrictEveryFrame. Also: useLeavingBoards (packages/pages/src/one-place.tsx) has the clock-from-render timing and moved element that #645 fixed for buildings, and a building taken back mid-sink jumps to full height instead of rising from where it got to. Ask: each failure named as harness or face and fixed on the right side."
acceptanceCriteria:
  - "one-face passes at --slow 4 on GitHub's runner three runs in a row (harness)"
  - "A board leaving keeps its place among the others and is removed at its sink's end, as a building is (test)"
  - "A building taken back mid-sink rises from the height it reached (harness claim)"
priority: "medium"
tags:
  - "graview"
  - "pages"
  - "hq:feature:f-one-face-holds-at-slow-4"
source: "Graview HQ feature:f-one-face-holds-at-slow-4"
---
