---
"@graview/skills": patch
---

The lens skill says where `arrangeable` is imported from. The arrangement functions moved from `@graview/core` to `@graview/core/arrange`, and the skill still named `arrangeable(schema, kind)` with no import, so an assistant following it would import it from the main entry and get nothing. It now names the subpath.

Compatibility: unchanged — the skill's text only.
