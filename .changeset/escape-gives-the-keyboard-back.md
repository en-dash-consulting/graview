---
"@graview/primitives": patch
---

Escape on a popover gives the keyboard back to the button that opened it. The activity list, the problems list, the chat panel and the profile pane each closed on Escape and left the keyboard on the control inside the pane that had just gone, so the next Tab started from the top of the document — and in WebKit went nowhere. `closeToTrigger` moves the keyboard to the popover's own `aria-expanded` button when it was inside, and leaves it alone when it never was.
