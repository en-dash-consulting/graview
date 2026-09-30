---
"@graview/embed": patch
---

`<Embed>` keeps the store it made when another seat sits down. Handed no store of its own, it built one from the declaration and the seed, and rebuilt it whenever the principal changed — the principal was in the memo's dependencies, and was handed to a `Store` that takes no such option — so a React host that changed seats lost every edit and the history with them. Who is at the keyboard is the provider's business; the store stays.
