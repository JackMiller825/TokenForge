# TokenForge — Module 01, Reference Asset Downloader

TokenForge collects public files from a reference website and exports them as a ZIP with stable filenames and a versioned manifest. This repository is Module 01 of a larger token-website builder. It does not generate a token site.

The working path is **enter a URL, scan, review the files, download a ZIP**.

## Requirements

- Node.js 20.9 or newer
- Chromium for Playwright

```bash
npm install
npx playwright install chromium
npm run dev
```

Open http://localhost:3000. The production process is `npm run build` and `npm start`. It has to be a long-lived Node.js server with Chromium installed. A static host, including GitHub Pages, cannot run the scanner.

## Scan modes

| Mode | What it does | Default limit |
| --- | --- | --- |
| Quick | First page, plus a short scroll for lazy media | 1 page, about 45 seconds |
| Deep | Same-origin HTML pages | 6 pages, depth 2, about 2 minutes |
| Full | Scrolls and safe clicks on buttons, tabs, and disclosures | 3 pages, depth 1, 8 clicks, about 90 seconds |

You can raise Deep and Full to 12 pages and depth 3. Quick always stays on the first page. Full discovery never submits a form, connects a wallet, approves a transaction, or starts a purchase. Linked paths that `robots.txt` disallows for `User-agent: *` are not crawled. The page you typed is still opened, and the result says so when that path is disallowed.

Discovery reads the document, `src`, `data-src`, `srcset`, pictures, video posters, stylesheets, `@import`, computed backgrounds, and browser network responses, including CDN URLs. Advertising and analytics hosts are skipped unless you enable trackers.

## Filenames and ZIP layout

Original basenames are preserved, including capitalization and Unicode. Path traversal, control characters, and Windows reserved names are removed. Case-insensitive collisions get a stable `__2`, `__3` suffix. A hashed filename stays hashed. If the URL has no filename, the archive uses `asset-N.ext` and sets `filenameInferred`. An extension added from the content type or file signature is also marked inferred. TokenForge does not replace those with a made-up description.

Organized mode (default):

```text
images/  videos/  fonts/  audio/  styles/  scripts/  documents/  other/
manifest.json
README.md
```

Source mode keeps a sanitized host and directory. After export, the card, the ZIP entry, and `manifest.json` use the same path.

## Manifest 1.0.0

`manifest.json` records the stable id, source URL, resolved URL, original filename, saved filename, output path, category, MIME type, extension, size, dimensions, SHA-256, discovery method, referencing pages, status, and error. Older readers can still use `url`, `filename`, `category`, `source`, `status`, `bytes`, and `outputPath`. The `modules` object is reserved for later TokenForge stages and is null in this module.

## Limits

- 25 MB per file (`TOKENFORGE_MAX_ASSET_BYTES`)
- 160 MB per archive (`TOKENFORGE_MAX_TOTAL_BYTES`)
- 250 files per export, 700 discovered files
- 4 concurrent downloads, 3 retries with backoff, 15 second timeout
- Download links expire after 15 minutes

A file that fails does not remove files that succeeded. The failure is shown in the dashboard and in the manifest.

## Security

Treat every URL, redirect, filename, and response as untrusted.

- Only `http` and `https` on ports 80 and 443
- Credentials in URLs are rejected
- Loopback, private, link-local, metadata, documentation, and single-label hosts are rejected
- The check runs again for every redirect and subresource
- Node downloads resolve DNS at connection time and refuse a non-public answer
- Chromium traffic goes through a local egress proxy that pins the address it just validated
- Previews are limited to images, video, audio, and fonts, with `nosniff` and `Content-Security-Policy: default-src 'none'; sandbox`
- SVG previews that contain script are served as plain text
- Downloaded scripts are stored, not executed
- Set `TOKENFORGE_AUTH_TOKEN` before the server is reachable beyond your machine. Creating a scan or export then requires `Authorization: Bearer …`
- Download and preview URLs are unguessable capabilities. Export links are HMAC-signed and expire
- Rate limits are global unless `TOKENFORGE_TRUST_PROXY=1`, in which case the first `X-Forwarded-For` value is used
- Service workers are blocked in the scan browser. Environment variables are not exposed to the page

DNS pinning is not a substitute for a network egress firewall. Run the public service in a network that cannot reach private addresses.

## Project layout

```text
src/app/                  dashboard, help, API routes
src/components/           gallery and asset details
src/lib/security/         URL policy, pinned fetch, browser egress proxy
src/lib/classify/         extension, MIME, and file-signature identification
src/lib/discover/         URL, DOM, CSS, tracker, and robots parsing
src/lib/browser/          Playwright scan worker
src/lib/download/         bounded, retrying downloads
src/lib/archive/          filenames, manifest, streaming ZIP
src/lib/jobs/             local job state and expiring export links
src/lib/modules.ts        contracts for modules 02–06
tests/                    unit tests and a local fixture site
public/demo/              sample library used by the static preview
```

Job state is stored in `.data/`. That directory is local scratch space, not a database. The same module boundaries can later move blobs to object storage and jobs to a queue without changing the manifest.

## Later modules

Module 01 only fills the manifest. These contracts live in `src/lib/modules.ts` and are not implemented:

- Module 02 — Website Analyzer: screenshots, sections, color, type, motion
- Module 03 — Asset Replacement Studio: map a new brand onto reference files
- Module 04 — Token Identity Studio: name, ticker, chain, contract, supply, taxes, socials, copy
- Module 05 — Website Generator: build a Next.js site from the manifest and replacements
- Module 06 — Visual Comparison and Publishing: compare, check responsiveness, prepare deploy

## Scripts

```bash
npm run dev
npm run typecheck
npm test
npm run build
npm start
npm run build:pages
```

`npm test` uses Vitest. Browser coverage runs against a local fixture site, not a live token website. The fixture includes normal images, CSS backgrounds, lazy images, a video poster, an external image, srcset, nested stylesheets, duplicate filenames, and a button that inserts an image.

## GitHub Pages

https://jackmiller825.github.io/TokenForge/ is a static preview of the dashboard plus the sample library. The scan API and Chromium are not running there. Use the sample library to review the interface, and run `npm start` when you need a real scan.

## Known limitations

- Headless Chromium is not disguised. Sites that block automated browsers return a partial or failed scan.
- `blob:` URLs, DRM, login walls, and paywalled files are not collected.
- HLS and DASH playlists are not merged into a single video.
- Cookies set during the scan are kept in memory only so a later download of that same public page can reuse them. They are not written to the manifest or disk.
- Each accepted file is buffered up to its size cap. The ZIP itself is streamed from temporary files, not built entirely in memory.
- The job runner lives in the Node process. A restart marks a running job as interrupted.
- Very large galleries are paged 24 at a time rather than virtualized.
- Content-hash matches are recorded on `sameContentAs`. Both filenames are still saved when their paths differ.
- Single-label hostnames are blocked. Real public sites use a dotted hostname.

Only collect assets you have the right to use.
