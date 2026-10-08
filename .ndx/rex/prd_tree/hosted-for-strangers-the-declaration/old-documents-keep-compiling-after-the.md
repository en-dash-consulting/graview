---
id: "5a0f19f6-f534-43c6-873e-43f30eb9b872"
level: "feature"
title: "Old documents keep compiling after the en-US renames (FR-134)"
status: "completed"
priority: "critical"
tags:
  - "graview-cloud"
  - "FR-134"
  - "bug"
  - "document-format"
source: "Graview Cloud, 2026-10-08 (brief after 0.1.16)"
completedAt: "2026-10-08T12:25:30.000Z"
endedAt: "2026-10-08T12:25:30.000Z"
acceptanceCriteria:
  - "Reading a document accepts settings[].honoured as honored, and any other key the 0.1.16 en-US pass renamed in the document format"
  - "toDocument writes the new spelling"
  - "A document exported under 0.1.10 compiles on 0.1.17 unchanged, and the next save writes honored"
  - "The release notes list the migration"
description: "0.1.16 renamed SettingDeclaration.honoured to honored in the document as well; a 0.1.10 export fails with 'Nothing knows how to apply undefined', though the release notes said the document format was unchanged."
lastModified: "2026-10-08T15:30:00.000Z"
resolution: "Shipped in #141 (0.1.17): RESPELLED reads a setting's honoured as honored on every reader (readDocument, compileDocument, compileDocumentWithoutCheck, appFrom, appFromOrCompile, diffDocuments, editDocument), toDocument writes the new name, and fixtures made by 0.1.10 and 0.1.15 from npm must compile. #143 added pages.overview read as pages.scene. The review after 0.1.16 (review/after-0-1-16) kept pages.scene at the 40 characters pages.overview allowed, read arrange-pages' overview as scene, and made an empty edit list give the current spelling too."
---
