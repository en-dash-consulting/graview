---
"@graview/primitives": patch
---

A video's figure and a picture opened full size each carry a Download link. A document's line had Open and Download; a video field's player had none, and a picture's full-size dialog had only Close, so a render could not be saved from a phone. Each now shows a Download link, named "Download <file name>" for a reader, to the file where the host serves it with `?download=1` (`&download=1` where the address already asks something, and before any `#`), which Graview Cloud is to answer as an attachment; in the dialog it stands beside Close. Both, and Close, are at least 44 px each way, a thumb's press. What the video's caption says (`data-graview-video-said`) is unchanged. Held by a unit test of primitives (`a-video-and-a-full-size-picture-offer-a-download`).

Compatibility: unchanged on every surface. What Graview Cloud does: answer `?download=1` on a kept file with `Content-Disposition: attachment` (feature f-download-kept-files); until then the link opens the file.
