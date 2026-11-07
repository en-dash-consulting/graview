---
id: "ead25e4a-f355-4656-bfbe-6c3510ff9220"
type: "capability"
title: "graview preview: mount the default faces on a document with no product"
slug: "graview-preview-mount-the-default"
statement: "graview preview mounts Graview's default faces, the scene and the pages in Graview's own shell, over the served store for a JSON document and a seed snapshot, with no product needed."
criteria: [{"id":"c1","text":"When given a document and a --seed snapshot, graview preview shall mount the default faces (scene and pages, Graview's own shell) over the served store."},{"id":"c2","text":"When given only a JSON document and a seed, graview preview shall draw the scene and the pages without a product."}]
source: "n-dx-graview"
resolution: "Subsumed by 'graview preview and graview shots' (what n-dx surfaced), done in #200."
---

graview serve serves the store (HTTP plus the WebSocket wire) and draws nothing, so a stranger holding only a JSON document and a seed has no way to look at it: the scene and the pages need a product. A graview preview <document> --seed <snapshot> that mounts the default faces (scene and pages, Graview's own shell) over the served store would be what serve already looks like it does. Surfaced by n-dx-graview, the product n-dx's projection is drawn with; see its UPSTREAM.md.
