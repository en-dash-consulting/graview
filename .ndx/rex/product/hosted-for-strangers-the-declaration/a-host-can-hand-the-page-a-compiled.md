---
id: "3013eb91-ee8a-4d06-ab83-72442b724b78"
type: "capability"
title: "A host can hand the page a compiled app, so the page no longer carries the compiler (FR-123)"
slug: "a-host-can-hand-the-page-a-compiled"
statement: "A host can hand the page a compiled app, so the page loads without carrying the document compiler."
criteria: [{"id":"c1","text":"When a host hands the page a compiled app, the page shall run on the compiled output of compileDocument, serialized and rebuilt by appFrom(compiled), or on a lighter compileForPage, without carrying the compiler."},{"id":"c2","text":"When Cloud's shell is given the server's compiled app, it shall load without document/compile, document/views and expr/evaluate in its first chunk."}]
tags:
  - "graview-cloud"
  - "FR-123"
source: "Graview Cloud, 2026-10-07 (brief after 0.1.14)"
priority: "high"
resolution: "Shipped in #125 (0.1.15): serializeCompiled gives graview-compiled@1; appFrom and appFromOrCompile from @graview/core/compiled build the app without the compiler. The framework's hosted page loads 512.9 KB up front handed one against 557.1 KB compiling; Cloud's shell built against these sources 554.8 KB to 511.4 KB. The second criterion holds for document/compile and document/views; expr/evaluate stays in the first chunk on purpose, since the page judges guards, rules and computed values with it. A review before the release refused a torn compiled app as compiled-shape rather than throwing, and built one only beside the document it was made from."
---

Cloud compiles the document on the server at every change and again in the page with compileDocumentWithoutCheck: most of core's eager weight (Cloud's shell 584 KB).
