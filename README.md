# TokenForge — Reference Website Intelligence

TokenForge is the reference half of a token-website builder.

- Module 01 downloads public files into a ZIP with stable filenames and manifest 1.0.0.
- Module 02 analyzes an authorized page into screenshots, sections, observed design values, asset positions, and a blueprint ZIP at schema 2.0.0.
- Phase 3, the Replacement Studio, maps uploaded artwork onto that project and exports `tokenforge-replacement-package.zip` at schema 3.0.0.
- Phase 4, the Identity Studio, stores the token profile and exports `tokenforge-identity-package.zip` at schema 4.0.0. Phase 4 is ready for Phase 5.

Phase 5, the website generator, remains a contract in `src/lib/modules.ts`. Demo mode is sample data, not a scan.

The working path is **enter a URL, scan or analyze, map replacements, approve them, download the package**.

## Requirements

- Node.js 20.9 or newer
- Chromium for Playwright

```bash
npm install
npx playwright install chromium
npm run dev
```

Open http://localhost:3000. The production process is `npm run build` and `npm start`. It has to be a long-lived Node.js server with Chromium installed.

## Deployment

**Single Node app.** `npm start`, or `start-tokenforge.cmd` on Windows, serves the dashboard and the API on one origin. Use this when you want scanning, analysis, and the replacement studio.

**Split frontend and API.** GitHub Pages publishes the static dashboard only. Build it with `NEXT_PUBLIC_API_BASE=https://your-server.example`. On the server set `TOKENFORGE_ALLOWED_ORIGINS=https://jackmiller825.github.io`. The access token stays in `TOKENFORGE_AUTH_TOKEN` on the server. Do not put that token in `NEXT_PUBLIC_` variables.

The status menu shows Connected, Connecting, Unavailable, or Demo mode. Demo mode is explicit sample data.

Projects are indexed in SQLite through Node’s `node:sqlite` when that built-in loads. Otherwise the index is `projects/index.json`. Screenshots and analysis JSON stay as files, not database blobs. A later host can replace the index with Postgres or hosted SQLite without changing the file layout.

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
src/app/                  overview, downloader, analyzer, library, help, API routes
src/components/           shell, gallery, blueprint
src/lib/security/         URL policy, pinned fetch, browser egress proxy
src/lib/classify/         extension, MIME, and file-signature identification
src/lib/discover/         URL, DOM, CSS, tracker, and robots parsing
src/lib/browser/          Playwright scan worker
src/lib/analyze/          screenshots, sections, design tokens, asset map, blueprint ZIP
src/lib/replace/          uploads, variants, mapping, readiness, replacement ZIP
src/lib/projects/         SQLite or JSON project index, files for screenshots
src/lib/download/         bounded, retrying downloads
src/lib/archive/          filenames, manifest, streaming ZIP
src/lib/jobs/             local job state and expiring export links
src/lib/modules.ts        contracts for modules 03–06
tests/                    unit tests and local fixture sites
public/demo/              sample library used by the static preview
```

Job state and project files are stored in `.data/`. Screenshots are files. The project index uses SQLite when Node provides it. The same boundaries can later move blobs to object storage and the index to a hosted database without changing the blueprint schema.

## Later modules

Phase 4 is ready for Phase 5. The identity studio, schema 4.0.0 package, and readiness contract are implemented. Phase 5 and Phase 6 remain contracts in `src/lib/modules.ts`:

- Module 05 — Website Generator: build a site from the blueprint, approved mappings, and the identity profile
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

## Phase 2 blueprint

Analyze from **Website Analyzer**, or from **Analyze website** after an asset scan. The second path reuses the saved asset list and does not download those files again.

Default viewports are desktop 1440×900, tablet 768×1024, and mobile 390×844. Section roles are inferred unless you correct them. Asset URLs match a Phase 1 id only when the match is exact, canonical, or a unique path with an empty query. Animation records describe behavior the browser could see.

`reference-blueprint.zip` contains `manifest.json`, `README.md`, `assets/index.json`, `screenshots/`, and `analysis/` (`pages.json`, `sections.json`, `design-system.json`, `asset-map.json`, `animations.json`, `interactions.json`, `responsive.json`).

## Phase 3 replacement studio

Open **Replacement Studio** from a project in the library or from the analyzer. Upload images, video, or fonts. The server checks the file signature, stores the original upload, and can make a separate fitted variant with Sharp. Suggestions explain role and aspect ratio. Nothing is approved until you approve it.

Mark each reference asset Replace, Preserve, Omit, or Not applicable. Images and video start as Replace. Fonts start as Preserve. The readiness percentage uses only the Replace scope. Export `tokenforge-replacement-package.zip` for the mapped library. Original reference binaries stay out of that ZIP. Their ids and URLs remain in the Phase 1 manifest inside the package.

A screenshot overlay is a mockup. It is not a reconstructed page. One mascot upload does not recreate every pose or animation. Text inside a bitmap is recorded only when you mark it, except for an SVG that already contains a text element.

## Phase 4 identity studio

Open **Identity Studio** for a saved project. The reference title stays on the project. Token name, ticker, narrative, section copy, official links, SEO, and appearance are stored in `identity.json`, with manual snapshots in `identity/revisions/`. Autosave does not create a revision on each keystroke.

Ethereum, Base, and BNB Chain use a 42-character `0x` address. Solana uses its base58 form. A custom network needs a name and an address without spaces. Contract status `coming-soon` cannot include an address. `unverified` and `configured` are not shown as deployed.

Supply, taxes, liquidity, and ownership start as editing defaults. Liquidity and ownership evidence is `planned`, `pending-verification`, `verified`, or `not-applicable`. The preview qualifies anything that is not verified.

Section ids come from the Phase 2 blueprint. Tone presets do not overwrite writing. Empty-field suggestions are templates. Official links can be Coming Soon. The app does not invent social URLs. The brand consistency report flags stale reference names, foreign contract addresses, and unverified token claims.

`tokenforge-identity-package.zip` uses schema 4.0.0 and references Phase 3 approved asset ids instead of copying image binaries. `mapping/phase5-input.json` is the generator contract. Phase 5 readiness separates hard blockers from warnings. A configured address is still not described as an on-chain verified contract. The generator itself is not included. Autosave keeps a newer edit when an older response returns, and it says Not saved until you retry after a network failure.

## GitHub Pages

https://jackmiller825.github.io/TokenForge/ is the static frontend. Links use one `/TokenForge` prefix. The Next.js `basePath` adds it, and in-app links do not add it again. The site does not run Playwright. Connect it to a TokenForge server, or use Demo mode to inspect the sample blueprint. The sample is not an analysis of a live site. Identity export waits until the latest edit is saved. A failed save does not produce a package.

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
- GitHub Pages cannot capture screenshots, build a blueprint, process uploaded images, or save an identity profile by itself.
- Identity suggestions are templates. They do not claim endorsements, partnerships, or returns.
- Bitmap text is not rewritten. The brand report only lists assets you marked, plus SVG text TokenForge could see.
- The identity preview is a content and blueprint overlay, not a generated site.
- A fitted variant is a still frame. It does not invent a new pose or rebuild video motion.
- Inferred section roles are not certain until you correct them.
- Canvas drawing commands and original animation source are not recovered.
- Full-page captures taller than 12000px are marked partial.
- One browser task runs at a time.

Only collect assets you have the right to use.
