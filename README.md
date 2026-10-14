# Stack PDF

A browser-only PDF workspace for combining documents, reviewing pages, deleting pages, and reordering the final PDF.

## Live site

[Open Stack PDF](https://crazyskateface.github.io/pdf-combiner/)

## Run locally

Serve this directory with any static web server, then open the local URL in a browser:

```powershell
python -m http.server 4173
```

All PDF processing happens in the browser. The app loads PDF.js and pdf-lib from CDNs, so an internet connection is required when opening the app.
