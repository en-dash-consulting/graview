---
"@graview/ship": patch
---

`GET /graview/export` returns the bundle instead of a 500: the route called `exportBundle(store, app)` against `exportBundle(app, store)`, behind two casts that hid it from the compiler. The casts are gone and a serve test holds the route (FR-11).
