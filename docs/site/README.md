# The Graview page

`graview.html` is the source of the marketing page, published as a Claude
artifact at:

    https://claude.ai/code/artifact/407d388d-0523-4c33-ba0a-e305c37ad417

It is an artifact BODY, not a standalone document: the host wraps it in
`<!doctype html><head>…</head><body>` at publish time, so the file
deliberately has no `<html>`, `<head>` or `<body>` of its own. To open it
locally, wrap it:

```sh
printf '<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
</head><body>%s</body></html>' "$(cat docs/site/graview.html)" > /tmp/graview.html
open /tmp/graview.html
```

`endash-mark.svg` is En Dash's square mark, fetched from
`endash.us/images/LogoSquareNoWords.svg` and inlined into the page — the
artifact CSP blocks external images, so it has to be inline. It is also where
the page's palette comes from: navy `#001769` and mint `#00E5B9`.

Kept here so it survives; nothing in the build reads it.
