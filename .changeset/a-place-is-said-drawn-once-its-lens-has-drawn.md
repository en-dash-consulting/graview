---
"@graview/react": patch
"@graview/embed": patch
"@graview/pages": patch
"@graview/primitives": patch
---

A place is said drawn once its lens has drawn, so `graview shots`, `graview preview`'s pages and a host waiting on `data-graview-drawn` or `onDrawn` picture the lens rather than its page's head over nothing. Threat Watch's What to do place — a blocks lens declared in the document — was photographed as its title, "8 remediations." and "All remediations as a list", with the rest of the page blank: the lens's module had arrived, so nothing was said to be on its way, but React reveals a part that suspended in a commit it holds back up to 300 ms after the page around it first drew, and the page had been still long enough to be said settled (about 310 ms after load, the rows drawn at about 380). Now each part that suspends on a watched place — a lazy module's part, and a component behind `lazyPart` — is waited for until it has drawn there, or said it did not arrive; a place left before such a part drew does not hold up the next one. The place is said drawn about 240 ms after its lens draws, and a move between places still settles in about 300 ms. A hosted page carries 0.9 KB more up front for it (0.3 KB gzipped; the compiled page too), and both budgets are raised by that.

Compatibility: ops, stored formats, the wire, the declaration, check findings and derived tools are unchanged. New on `@graview/react` and `@graview/react/provider`: `PartsWatch`, `PartsWatchContext`, `createPartsWatch`, `partsWatchMoved`, `partsWaiting` and `lazyPart` (`React.lazy` whose part is waited for until it has drawn). `data-graview-drawn` and `onDrawn` keep their meaning and come later only where a part was still to be drawn. What Graview Cloud does: nothing — describe_place's pictures of a declared lens's place show the lens without a wait of its own.
