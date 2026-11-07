---
id: "6fb29d72-1be6-4980-8b42-ae60f622c031"
type: "capability"
title: "A host that owns the page gives the routed face the address bar (FR-106)"
slug: "a-host-that-owns-the-page-gives-the"
statement: "A host that owns the page can give the embed's routed face the address bar, so places, records and the home each have an address that can be linked, reloaded and shared."
criteria: [{"id":"c1","text":"Where an embed option (routing: \"memory\" | \"address\", or an initial path plus onNavigate) is set, the pages face shall read its route from location and push history."},{"id":"c2","text":"The pages face shall give places, records and the home each their own address."},{"id":"c3","text":"While an embed sits inside somebody else's page, the pages face shall use memory routing by default."},{"id":"c4","text":"When /places/<slug> is loaded in Cloud's shell, the pages face shall open that place."},{"id":"c5","text":"When a record is opened in Cloud's shell, the pages face shall change the address to that record's address."},{"id":"c6","text":"When Back is used in Cloud's shell, the pages face shall return to the previous address and page."},{"id":"c7","text":"When the page is reloaded in Cloud's shell, the pages face shall stay on the same address and page."},{"id":"c8","text":"While an embed sits in an article, the pages face shall keep its behaviour unchanged."}]
tags:
  - "graview-cloud"
  - "FR-106"
source: "Graview Cloud, 2026-10-06 (brief after 0.1.12)"
priority: "high"
---

The embed's routed face runs on a memory router, so in a hosted app a place can't be linked, reloaded or shared; loading /places/vendors-by-status draws the home.
