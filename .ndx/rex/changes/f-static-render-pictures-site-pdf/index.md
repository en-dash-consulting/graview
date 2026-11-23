---
id: "f9fb1681-6c8f-44ef-baa4-8cbed6366893"
type: "change"
title: "The static renderer draws pictures, renders a whole site with in-file anchors, and prints to PDF"
slug: "f-static-render-pictures-site-pdf"
intent: "From HQ feature:f-static-render-pictures-site-pdf (Cloud built an app exported as one HTML file and live documents on renderPlace): (1) renderPlace draws picture fields itself; (2) a renderSite / multi-page entry with in-file anchors, so Cloud need not rewrite base links; (3) a PDF from the static render (live documents serve HTML only)."
acceptanceCriteria:
  - "renderPlace draws a kind's picture fields (test)"
  - "renderSite renders every place into one file whose links are in-file anchors (test)"
  - "A PDF is made from the static render, or the change says why it is the host's (test or decision recorded)"
priority: "medium"
tags:
  - "graview"
  - "pages"
  - "hq:feature:f-static-render-pictures-site-pdf"
source: "Graview HQ feature:f-static-render-pictures-site-pdf"
---
