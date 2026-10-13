---
"@graview/pages": patch
---

A place rendered to static HTML is said in the reader's locale (FR-174, FR-178). `renderPlace` landed beside the app's locale and wrote every page `<html lang="en">` with its days said in the declaration's brand, whatever brand it was handed and whatever locale the reader reads in. It takes `locale`, the reader's, as the routed face does: days, times and numbers are said in it, then in the `locale` of the brand the page wears, then en-US, and the document says it as its `lang` (`<html lang="en-GB">`). A tag the runtime can say nothing in is en-US. The glance beside each listed record is said in it too.

Compatibility: additive. `RenderPlaceOptions` gains `locale`; a page rendered without one says `lang="en-US"` where it said `lang="en"`.
