---
"@graview/pages": patch
"@graview/skills": patch
---

A static page wears a product's own design (Nick, making graview.dev a Graview app). `renderPlace` from `@graview/pages/static` wrote the derived page or nothing, so a product whose site is its records could print a record only in the framework's look, while the routed face has always taken a design as a registry of pages. It now takes `design`: `records[kind](record, site)` writes a record's page in the product's own markup, and `document(page)` writes the document around whatever a page says — handed its title, language, scheme, the app's stylesheet and masthead, the page's markup, whether it was found, and the record it is about. A design reads only what the seat may see: a `StaticRecord` is the record's fields as that seat reads them and `related(edge, direction?)`, the records it relates to by one relation in the order they were related, and `StaticSite` gives every record of a kind, one by id, and an address under the base; a kind kept from the seat is not there. A writer that answers `undefined` leaves the derived page, and a page with no design is written exactly as before. graview.dev renders every page it serves this way, from its own declaration (`apps/site/app.json`) and the records written out of the repository. The graview-lists skill says how.

Compatibility: ops, stored records, wire messages, the declaration and tool names are unchanged. `@graview/pages/static` exports the types `StaticDesign`, `StaticDocument`, `StaticRecord` and `StaticSite`, and `RenderPlaceOptions` takes `design`.
