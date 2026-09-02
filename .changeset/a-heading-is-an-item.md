---
"@graview/primitives": patch
---

The actions strip's section headings are real list items again: they
carried `role="presentation"`, which strips the list-item role and makes
the list invalid to assistive technology — the todo example's new
accessibility run caught it on a selected node with a broken rule.
