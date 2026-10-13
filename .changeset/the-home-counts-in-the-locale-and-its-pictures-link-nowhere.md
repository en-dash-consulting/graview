---
"@graview/pages": patch
---

The home counts in the page's locale, and its pictures link nowhere themselves (the ninth walk, W-198 and W-200). The routed home's headline counted each kind by hand — "14 apiaries, 280 hives, 64 beekeepers, 7540 inspections" — and now says it as `counted` does, "7,540 inspections", as do the count beside each kind and "See all 1,201 hives" under a list cut short. And the gallery's card for a lens is a link, while a status board drawn small in it drew each record's card as a link too: React logged "<a> cannot be a descendant of <a>" on every visit, and a browser's parser takes such markup apart. A picture in a gallery card now draws its records without links.

Compatibility: the words a person reads change where a kind holds a thousand or more; the gallery's pictures, already inert, hold no `<a>`.
