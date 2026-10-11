---
"@graview/core": patch
---

A document is tested from where it lives. n-dx's face tested the document n-dx emits by copying it into `tests/fixtures` and holding the copy to the original with a drift test of its own. `compileDocumentFiles(document, { seed })` from `@graview/core/testing` reads both from their paths (relative to the working directory, or a `file:` URL), compiles the document with the checker — a refusal throws, saying every finding — and hands back the app, the document and seed as read, the checker's findings, and `store()`, a fresh store over the seed with the app's own acts, rules and policy each time it is called.

Compatibility: ops, stored formats, wire messages, the document format, the compiled format, check finding codes and tool schemas are unchanged. Added: `compileDocumentFiles` and `DocumentFiles` on `@graview/core/testing`, which now reads files with `node:fs`; it was, and is, an entry for tests in Node.
