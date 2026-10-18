---
"@graview/core": patch
---

Two records of one name are never told apart by their id. A festival with three films called "Small Harbor" offered "Small Harbor · film:small-harbor" in every picker, the search page and Find, because no one fact told all three apart and `tellApart` fell back to the id. It now says two facts together ("Ana Smith · Shorts"), else the one fact a record holds alone, else which of them it is in the order they were made ("2 of 3").

Compatibility: no surface changes; a picker's, an ask's and a search hit's words for namesakes change where they said an id.
