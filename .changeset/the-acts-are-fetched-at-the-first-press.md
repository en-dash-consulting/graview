---
"@graview/primitives": patch
---

The inspector's pane is fetched at the first press on the page, not only when the page is first idle. Since the scene came to draw without it, a pick made before the page was ever idle — the studio opened in an embed, a field picked at once — fetched the pane only as the pick was made, and its acts arrived a beat after the strip should have shown them. `Inspector` now starts the fetch at the first pointer or key pressed anywhere on the page, or when the page is first idle, whichever comes first; a pick that follows the press finds the pane there or on its way. The scene before it draws and a hosted page's first load are unchanged (856 430 and 560 397 bytes over the vendors document). The embed's studio test waits for the pick's acts as a person would see them arrive, rather than reading the strip in the commit the pick was made.

Compatibility: unchanged.
