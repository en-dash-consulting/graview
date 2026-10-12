---
"@graview/core": patch
"@graview/primitives": patch
---

A file field's editor adds to what the field holds when the host's upload answers, not to what it held when the file was sent, so a picture somebody else put on the record meanwhile is kept (FR-163). A file the field already holds is said ("“porch.jpg” is already here.") and not held twice; several files given to a field that holds one say which were left out ("Photos holds one picture, so “b.png” was left out."); and when a list's file is moved earlier or removed, the keyboard stays in the editor — on the moved file, the next file's Remove, or Choose pictures — rather than on the page. Removing a record counts each of its files once, however many of its fields hold it ("Remove Fix the roof and its 2 files").

Compatibility: unchanged. A derived `remove-<kind>`'s sentence counts a file two fields hold once, where it counted it twice; tool names and input schemas are unchanged.
