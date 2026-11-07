---
id: "635b55e6-c088-401a-ace2-6cb7088a7cb1"
type: "capability"
title: "Putting a file on a record from the page, through the host's files (FR-163)"
slug: "putting-a-file-on-a-record-from-the"
statement: "A host can hand Graview a files seam, and every face then lets a person put a file on a record through it, with refusals said in words and the upload recorded as an ordinary, undoable set-field act."
criteria: [{"id":"c1","text":"The product shall accept a host files seam on mount, exactly files?: { upload(file: Blob, name: string): Promise<FileValue>; maxBytes: number; kinds: readonly string[] }, and thread it through mount, <Embed>, GraviewProvider and the Shell."},{"id":"c2","text":"The file field's editor shall offer picking a file, taking a photo, drag and drop, and paste on every face, and shall accept several files at once for a list field."},{"id":"c3","text":"When a person sends a camera photo, the editor shall downscale it in the page before sending it."},{"id":"c4","text":"When a person sends a HEIC file, the editor shall convert it where the browser can decode it, otherwise send it as is where kinds allows HEIC, otherwise say so."},{"id":"c5","text":"When a file exceeds maxBytes, is not of an allowed kind, or upload throws a refusal, the editor shall say it in its own words."},{"id":"c6","text":"When an upload succeeds, the product shall apply it as the ordinary set-field act, recorded in history and undone as any act."},{"id":"c7","text":"If the host supplies no files seam, the editor shall say this host takes no files and shall offer nothing it would refuse."},{"id":"c8","text":"The product shall provide a dev upload door for harnesses and examples that is never present in a build, and an example app with a file field."},{"id":"c9","text":"A browser harness shall check upload by input and by paste, a thumbnail drawn, the gallery shown full size, a PDF shown inline, a refusal said in words, and undo removing the file."}]
tags:
  - "graview-cloud"
  - "FR-163"
  - "embed"
  - "files"
source: "Graview Cloud, the brief after 0.1.23"
priority: "high"
resolution: "Done in #223: HostFiles on mount, <Embed>, GraviewProvider, the Shell and PagesApp; the editor on the scene's record, the record page, the forms and the strip's ask; devFiles and filesAt for development; the todo example's attachments; scripts/verify-files.mjs."
---

A file field needs a way in. Cloud's route stores bytes at /graview/files/<sha256>.<ext> and answers the value; the framework needs the seam a host hands it and an editor on every face that sends to it.
