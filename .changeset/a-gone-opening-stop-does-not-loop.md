---
"@graview/react": patch
---

A page opened on a stop whose record is gone lands where the app opens, instead of re-rendering for ever. The stop an app is opened on is its home, and a focus on a record that is no longer there falls back to the home. When the opening stop itself named the record, the fallback put the dead id straight back, the next render took it out again, and the scene never settled. That happened to an embed handed `#focus=<id>` for a record since removed, to an embed opened at an address (FR-106) whose fragment names a record that is gone or that the seat may not see, and to any of them when an act removed the record it opened on. React gave up with "Maximum update depth exceeded", the face's boundary drew it again, and the tab hung. A home that names something gone now gives way to where the declaration opens, or to altitude when it names nowhere.

Compatibility: unchanged for ops, stored formats, the wire, the declaration and check finding codes, and tool schemas. A provider whose opening stop names a gone record now opens where the declaration opens.
