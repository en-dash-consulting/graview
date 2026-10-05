---
"@graview/react": patch
---

A dialog a popover opens takes over from it. The studio opens from a button in the profile menu, and with the profile in the top layer (FR-76) the menu stood over the studio's bar. When the keyboard goes into a dialog the popover does not hold, the popover closes — its pane stays mounted where its owner keeps it so, and the dialog with it — and when that dialog is gone and has left the keyboard nowhere, because its way back was a control in the closed pane, the keyboard goes to the popover's trigger. A unit test opens a dialog from a popover, finds the popover closed, closes the dialog and finds the keyboard on the trigger; `verify-studio` opens the studio from the profile and closes it with nothing left on `<body>`. `verify-studio` and `smoke-create` follow the family too: the studio's seat is opened again after a press elsewhere in the studio closes it, and a narrow embed's profile is held to being whole on screen and on top rather than inside the embed's box.

Compatibility: unchanged — ops, stored formats, the wire, check codes and tool schemas.
