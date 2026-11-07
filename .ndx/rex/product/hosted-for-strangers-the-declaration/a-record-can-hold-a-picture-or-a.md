---
id: "e8c2642c-f325-4163-8605-03d1522966df"
type: "capability"
title: "A record can hold a picture or a document (FR-162)"
slug: "a-record-can-hold-a-picture-or-a"
statement: "A Graview record can hold an image or a file, stored by the host, and shows it wherever the record is drawn."
criteria: [{"id":"c1","text":"Graview shall accept the field types image and file, and a list with of image or file, in TypeScript (imageField, fileField) and in the document format, through the compiler, document.schema.json, graview types and typed, and the check."},{"id":"c2","text":"The system shall hold a file field's value as FileValue { href, name, type, bytes, width?, height?, caption? } and validate it."},{"id":"c3","text":"If a FileValue's href has a scheme of any sort, names another host, contains a backslash or climbs a path, the system shall refuse it, so that an href is only a path on the host."},{"id":"c4","text":"Where a record is drawn, the system shall show a file value as a thumbnail on cards and rows and as a gallery on the record page that opens each image full size."},{"id":"c5","text":"Where a record is drawn, the system shall show a document by its name, type and size, a PDF inline, and any other file as a download."},{"id":"c6","text":"The card, row, page and home lenses shall offer an image block of the form { image, as: thumb | gallery }."},{"id":"c7","text":"When a field or record is removed, the system shall say which files would be lost, and the host shall decide what happens to the bytes."},{"id":"c8","text":"Export and remix shall carry file values as they carry any other field."},{"id":"c9","text":"The agent's tools shall describe the image and file types, and a seat may set a file field to a value the host gave."},{"id":"c10","text":"The system shall give every image alt text: its caption, else its name."},{"id":"c11","text":"The hosted page's first load shall not grow because of image and file fields."}]
tags:
  - "graview-cloud"
  - "FR-162"
  - "document"
  - "files"
source: "Graview Cloud, the brief after 0.1.23"
priority: "high"
resolution: "Done in #223: image and file fields in both declarations, FileValue validated as a path on the host, drawn as thumbnails, a gallery and documents behind one lazy door, the image block, files lost said by a removal and a migration; the hosted page's first load is 1,609 bytes smaller. Views in a guest frame or worker are not yet handed the addresses they may put in an img."
---

A record could hold words, numbers, dates and choices, and nothing a person photographs or is sent. Cloud's apps need a receipt's photo, a quote's PDF and a job's pictures on the record itself, stored by the host and shown wherever the record is.
