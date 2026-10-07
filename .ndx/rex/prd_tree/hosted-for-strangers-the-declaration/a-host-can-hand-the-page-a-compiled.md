---
id: "3013eb91-ee8a-4d06-ab83-72442b724b78"
level: "feature"
title: "A host can hand the page a compiled app, so the page no longer carries the compiler (FR-123)"
status: "pending"
priority: "high"
tags:
  - "graview-cloud"
  - "FR-123"
source: "Graview Cloud, 2026-10-07 (brief after 0.1.14)"
acceptanceCriteria:
  - "compileDocument output that serializes (rebuilt by a small appFrom(compiled)) or a lighter compileForPage; either way the page no longer carries the compiler"
  - "Cloud's shell, given the server's compiled app, loads without document/compile, document/views and expr/evaluate in its first chunk; the saving is reported"
description: "Cloud compiles the document on the server at every change and again in the page with compileDocumentWithoutCheck: most of core's eager weight (Cloud's shell 584 KB)."
lastModified: "2026-10-07T14:07:03.672Z"
---
