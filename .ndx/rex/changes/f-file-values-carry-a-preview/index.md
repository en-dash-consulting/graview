---
id: "b2638751-5756-4338-9488-d00cae543158"
type: "change"
title: "File values carry a preview picture, and keep their href when a view declares pictures"
slug: "f-file-values-carry-a-preview"
intent: "From HQ feature:f-file-values-carry-a-preview (framework half of Cloud's f-file-first-page-previews): a file value, single or in a list, may carry a host-made preview (thumb and src) that views, cards, rows and record pages draw as they draw an image field's; the manifest's pictures option resolves it; and declaring pictures no longer strips href from the files in other fields."
acceptanceCriteria:
  - "A file value with a preview is drawn with its picture on cards, rows and record pages (test)"
  - "A view's pictures option resolves a file's preview (test)"
  - "Declaring pictures keeps href on files in other fields (test)"
  - "docs and the Compatibility line say what a host hands"
priority: "medium"
tags:
  - "graview"
  - "core"
  - "guest"
  - "primitives"
  - "hq:feature:f-file-values-carry-a-preview"
source: "Graview HQ feature:f-file-values-carry-a-preview"
---
