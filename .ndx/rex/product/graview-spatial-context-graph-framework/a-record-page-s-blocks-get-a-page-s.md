---
id: "da9b5d63-6fa2-4227-a67e-d717b04c27f3"
type: "capability"
title: "A record page's blocks get a page's budget by default"
slug: "a-record-page-s-blocks-get-a-page-s"
statement: "A record page resolves its blocks under the page's own step budget by default, so lists on a page with many related records are drawn rather than shown as '—'."
criteria: [{"id":"c1","text":"When a caller does not raise the budget, resolveBlocks shall judge a record page's blocks under the page's budget rather than a card's allowance of 500 steps."},{"id":"c2","text":"When a record page has many related records (for example a change with 98 tasks), the page shall resolve each of its lists to its contents rather than to '—'."},{"id":"c3","text":"When blocks are resolved for a card or a row, resolveBlocks shall keep the card's allowance of 500 steps as the default budget."},{"id":"c4","text":"When a caller raises the budget, resolveBlocks shall judge the blocks under the raised budget instead of the default for the slot."}]
source: "n-dx-graview"
resolution: "Done in #202, with resolveFor: a page, the home and a blocks lens are judged under PAGE_BUDGET (20 000 steps) by default and cards and rows keep 500; a change of 98 tasks lists them all on both faces (verify-declared, aRecordPageListsEveryRecordUnderAPagesBudget)."
---

resolveBlocks judges a record page's blocks under a card's allowance (500 steps) unless the caller raises budget, so a change with 98 tasks resolved every list on its page to '—'. A page is drawn once, not many times a frame: the default budget for a page slot should be the page's, with the card's kept for cards and rows. Surfaced by n-dx-graview (src/ui/declared.tsx).
