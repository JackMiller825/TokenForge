import Link from 'next/link';
import { linkHref } from '@/lib/format';

export default function HelpPage() {
  return (
    <article className="max-w-3xl text-[15px] leading-7">
      <Link href={linkHref('/')} className="text-sm text-lime">Back to the overview</Link>
      <p className="mt-8 text-xs font-semibold uppercase tracking-[0.2em] text-lime">Modules 01 through 04</p>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight">Reference website intelligence</h1>
      <p className="mt-4 text-muted">TokenForge downloads public files and then records how an authorized page is built. The asset scan and the visual analysis stay on one project. A finished download is not the same thing as a finished blueprint.</p>

      <h2 className="mt-10 text-2xl font-semibold">What Phase 2 does</h2>
      <p className="mt-3 text-muted">The website analyzer opens the page in Chromium and writes a blueprint: screenshots, detected sections, observed colors and type, asset positions, and motion it could actually see. It does not invent a design system and it does not recover the site’s source code.</p>

      <h2 className="mt-10 text-2xl font-semibold">Backend connection</h2>
      <p className="mt-3 text-muted">The status control has four states. Connecting means a health check is in progress. Connected means the TokenForge server answered. Unavailable means a backend URL was set and did not answer. Demo mode shows sample projects and a sample blueprint. Demo data is labeled and is not a scan.</p>
      <p className="mt-3 text-muted">GitHub Pages only hosts this interface. The site lives under <span className="font-mono text-[#e7edf6]">/TokenForge</span> once. Page links leave that prefix to the static build, so a second <span className="font-mono text-[#e7edf6]">/TokenForge</span> is not added by hand. Scanning and analysis run on a Node.js server with Chromium. Set the server URL in the status menu, or build the static site with <span className="font-mono text-[#e7edf6]">NEXT_PUBLIC_API_BASE</span>. That value is a public address, not a password. Leave <span className="font-mono text-[#e7edf6]">TOKENFORGE_AUTH_TOKEN</span> on the server and type it into the downloader when the server asks for it.</p>

      <h2 className="mt-10 text-2xl font-semibold">How to analyze a website</h2>
      <ol className="mt-3 list-decimal space-y-2 pl-5 text-muted">
        <li>Scan the URL from Asset Downloader if you also want the files. The project is saved when the scan completes.</li>
        <li>Choose Analyze website. TokenForge reuses the asset list already stored for that project and does not download those files again.</li>
        <li>You can also analyze a URL directly. That still renders the page, and it maps assets it can see even when no ZIP exists yet.</li>
        <li>Wait through the stages. The percentage moves only as stages finish. Cancel stops the browser.</li>
        <li>Open the blueprint. Export <span className="font-mono text-[#e7edf6]">reference-blueprint.zip</span> when the required screenshots exist.</li>
      </ol>

      <h2 className="mt-10 text-2xl font-semibold">Blueprint panels</h2>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-muted">
        <li>Sections lists detected regions, the inferred role, and a confidence score.</li>
        <li>The center pane shows the full-page capture for desktop, tablet, or mobile. Fit and zoom change the view, not the file.</li>
        <li>The side pane shows the selected section’s box, selector, assets, and observed motion.</li>
        <li>Observed colors are counted from computed styles. A declared CSS variable is marked when the same value appears in a custom property.</li>
      </ul>

      <h2 className="mt-10 text-2xl font-semibold">Screenshot settings</h2>
      <p className="mt-3 text-muted">Desktop is 1440 × 900, tablet is 768 × 1024, and mobile is 390 × 844. Device scale is 1. Captures wait for fonts and a short settle period. They do not wait for every network connection to go idle. A page taller than 12000px is marked partial. Section images use names such as <span className="font-mono text-[#e7edf6]">screenshots/desktop/section-01-hero.png</span>.</p>

      <h2 className="mt-10 text-2xl font-semibold">Section mapping</h2>
      <p className="mt-3 text-muted">Sections come from landmarks, headings, and visible layout, not only from <span className="font-mono text-[#e7edf6]">section</span> tags. A role such as hero or token is inferred unless you correct it. Saving a correction sets confidence to corrected-by-you. Rerunning analysis starts a new version and does not keep those edits.</p>

      <h2 className="mt-10 text-2xl font-semibold">Asset mapping</h2>
      <p className="mt-3 text-muted">Each visible image, video, poster, CSS background, or SVG records its section, box, fit, opacity, transform, radius, and stacking. A Phase 1 id is attached only when the URL matches exactly, by canonical URL, or by a unique path with no query string. Different query strings stay separate. Move an asset to another section when the match is ambiguous.</p>

      <h2 className="mt-10 text-2xl font-semibold">Animation limitations</h2>
      <p className="mt-3 text-muted">TokenForge records CSS animations, transitions, Web Animations API timings, sticky elements, video, canvas, accordions, and a few safe hovers. It does not replay wallets, forms, purchases, or logins. A carousel or parallax note is an inference. The record is observable behavior, not the original animation source.</p>

      <h2 className="mt-10 text-2xl font-semibold">Export files</h2>
      <p className="mt-3 text-muted">The blueprint ZIP contains <span className="font-mono text-[#e7edf6]">manifest.json</span>, <span className="font-mono text-[#e7edf6]">README.md</span>, <span className="font-mono text-[#e7edf6]">assets/index.json</span>, <span className="font-mono text-[#e7edf6]">screenshots/</span>, and <span className="font-mono text-[#e7edf6]">analysis/</span> with pages, sections, design-system, asset-map, animations, interactions, and responsive JSON. Schema version is 2.0.0. The asset downloader still writes manifest version 1.0.0.</p>

      <h2 className="mt-10 text-2xl font-semibold">Deployment</h2>
      <p className="mt-3 text-muted">One process: <span className="font-mono text-[#e7edf6]">npm run build</span> and <span className="font-mono text-[#e7edf6]">npm start</span>. The browser talks to the same origin. Split deployment: run that server behind HTTPS, set <span className="font-mono text-[#e7edf6]">TOKENFORGE_ALLOWED_ORIGINS</span> to the Pages origin, and set <span className="font-mono text-[#e7edf6]">NEXT_PUBLIC_API_BASE</span> when building the static frontend. Projects are stored in SQLite when Node provides <span className="font-mono text-[#e7edf6]">node:sqlite</span>, otherwise in a JSON index. Screenshots stay as files. A production migration can move that index to hosted SQLite or Postgres without putting PNG bytes in database rows.</p>

      <h2 className="mt-10 text-2xl font-semibold">Environment variables</h2>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-muted">
        <li><span className="font-mono text-[#e7edf6]">TOKENFORGE_AUTH_TOKEN</span> — required before the server is public.</li>
        <li><span className="font-mono text-[#e7edf6]">TOKENFORGE_SECRET</span> — signs download links.</li>
        <li><span className="font-mono text-[#e7edf6]">TOKENFORGE_ALLOWED_ORIGINS</span> — extra CORS origins, comma separated.</li>
        <li><span className="font-mono text-[#e7edf6]">NEXT_PUBLIC_API_BASE</span> — public API origin for the static frontend.</li>
        <li><span className="font-mono text-[#e7edf6]">TOKENFORGE_DATA_DIR</span> — where jobs, projects, and screenshots are stored.</li>
      </ul>

      <h2 className="mt-10 text-2xl font-semibold">Troubleshooting</h2>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-muted">
        <li>Unavailable usually means the server is stopped, the URL is wrong, or CORS does not include this site’s origin.</li>
        <li>Chromium missing: run <span className="font-mono text-[#e7edf6]">npx playwright install chromium</span> on the server.</li>
        <li>A site that blocks headless browsers returns a partial page or an error. TokenForge does not disguise the browser.</li>
        <li>Private, loopback, and metadata addresses are rejected, including after a redirect.</li>
      </ul>

      <h2 className="mt-10 text-2xl font-semibold">Asset Replacement Studio</h2>
      <p className="mt-3 text-muted">Open a saved project from the library or the analyzer and choose Replacement studio. The studio keeps three separate stores: the original scan and blueprint, the files you upload, and fitted variants made from those uploads. Refreshing the browser reloads the saved studio. You do not upload the same replacement again unless you want a new file.</p>
      <ol className="mt-3 list-decimal space-y-2 pl-5 text-muted">
        <li>Drop images, video, or fonts into the upload area. TokenForge checks the file signature, dimensions, and a content hash. A matching hash reuses the stored file.</li>
        <li>Roles such as mascot, logo, and banner are suggestions. Change a role when the guess is wrong.</li>
        <li>Choose Suggest mappings for recommendations. A suggestion explains the role and aspect ratio. Low-confidence suggestions are not approved for you.</li>
        <li>Map a file by hand, create a fitted variant, or mark the placement as custom artwork when one still image cannot cover that scene.</li>
        <li>The center pane compares the reference screenshot and the replacement. The overlay uses Phase 2 coordinates. It is a mockup, not a rebuilt page.</li>
        <li>Approve a mapping when it is ready. Bulk approval asks you to confirm. Reject or Restore clears a choice without deleting the original manifest.</li>
        <li>The readiness bar counts only assets marked Replace. Images and video start in that scope. Fonts start as Preserve. Scripts and other files start as Not applicable.</li>
        <li>Export <span className="font-mono text-[#e7edf6]">tokenforge-replacement-package.zip</span> when you want the mapped library. Schema version is 3.0.0.</li>
      </ol>
      <p className="mt-3 text-muted">Presets for a circular logo, website banner, Telegram banner, square mascot, and social image are starting sizes. Edit them or keep the reference dimensions instead. A variant is a resize, crop, pad, or circle mask. It is not new artwork, and it does not invent other mascot poses.</p>
      <p className="mt-3 text-muted">Mark an image as containing text when you can see a name or ticker in the pixels. TokenForge only detects text by itself when an SVG contains a text element. Identity Studio lists those marked images in the brand report. It does not paint a new ticker onto the bitmap.</p>

      <h2 className="mt-10 text-2xl font-semibold">Identity Studio</h2>
      <p className="mt-3 text-muted">Open Identity Studio from the library, the analyzer, or the main navigation. Pick a saved project. The reference title and URL stay on the project. The new token name, story, section copy, links, and SEO live in a separate identity profile. Approved Phase 3 files stay in the replacement studio and are referenced by id.</p>
      <h3 className="mt-6 text-lg font-semibold">Token identity</h3>
      <p className="mt-3 text-muted">Enter the token name and ticker. Ticker capitalization is stored exactly as you type it, from 1 to 12 letters or numbers. Choose Ethereum, Base, BNB Chain, Solana, or a named custom network. A Coming Soon contract must not also contain an address. An unverified address is shown as not verified and not deployed. A configured address is still not described as deployed.</p>
      <h3 className="mt-6 text-lg font-semibold">Tokenomics</h3>
      <p className="mt-3 text-muted">The form starts with a supply of 1,000,000,000, 0% buy tax, 0% sell tax, a liquidity label of Burned, and an ownership label of Renounced. Those are editing defaults. Liquidity and ownership each have their own evidence status: Planned, Pending verification, Verified, or Not applicable. The preview says planned or pending until you mark the evidence verified. TokenForge does not check a chain.</p>
      <h3 className="mt-6 text-lg font-semibold">Narrative and sections</h3>
      <p className="mt-3 text-muted">The story editor covers origin, mascot, personality, project, moments, community, voice, slogans, calls to action, FAQs, and roadmap. Formatting is limited to paragraphs, emphasis, lists, links, and headings. Scripts are removed. Tone presets are optional aids. Changing tone does not replace your writing. Fill empty fields inserts templates only into blank fields that you have not approved. Templates are labeled as templates.</p>
      <p className="mt-3 text-muted">Section rows come from the Phase 2 blueprint and keep those section ids. You can reorder, hide, edit mobile copy, attach approved artwork, duplicate a blueprint section, or restore its original name and role. A block without a blueprint source cannot be duplicated. New analyzer sections are added without reordering the ones you already arranged.</p>
      <h3 className="mt-6 text-lg font-semibold">Links, preview, and SEO</h3>
      <p className="mt-3 text-muted">Each official link has a type, label, URL, enabled state, Coming Soon or Configured status, and display locations for the header, hero, body, and footer. An optional icon is a name only. Remote icon files are not loaded. Coming Soon cannot include a URL. Configured links must be http or https. Nothing invents a Telegram, X, or explorer address. External links use <span className="font-mono text-[#e7edf6]">rel=&quot;noopener noreferrer&quot;</span>.</p>
      <p className="mt-3 text-muted">The preview has desktop, tablet, and mobile frames, an identity card, type and color, header and footer links, button labels, and section copy. It is a content preview and blueprint overlay, not a finished website. SEO fields cover the website title, meta description, Open Graph title and description, sharing image, favicon, canonical URL, robots, and a website structured-data flag. Length warnings start after 180 characters for the meta description and 200 for the sharing description. A canonical URL is omitted until you enter one.</p>
      <h3 className="mt-6 text-lg font-semibold">Brand consistency and revisions</h3>
      <p className="mt-3 text-muted">The report checks that the new name and ticker appear in the written profile, flags reference-title words and foreign contract addresses, lists images you marked as containing text, and warns when liquidity or ownership is not verified. Approve an exception when a reference word should stay. Raster text is not rewritten.</p>
      <p className="mt-3 text-muted">Edits autosave after a short pause. The status says Saving until the server confirms, then Saved. A network failure or a rejected save says Not saved and offers Retry save. A newer keystroke is kept when an older response arrives. Save revision stores a snapshot only after the current text is stored. You can compare or restore a revision, reset a single field, download the profile JSON, or import a schema 4.0.0 file. Import keeps this project’s reference title and does not adopt another project’s revision files. A save that arrives with an older timestamp is rejected so two editors do not silently overwrite each other.</p>
      <h3 className="mt-6 text-lg font-semibold">Identity export and Phase 5 readiness</h3>
      <p className="mt-3 text-muted">Export first saves the profile. If that save fails, the package is not created. A successful package is <span className="font-mono text-[#e7edf6]">tokenforge-identity-package.zip</span>. Schema version is 4.0.0. It contains <span className="font-mono text-[#e7edf6]">identity/token.json</span>, <span className="font-mono text-[#e7edf6]">tokenomics.json</span>, <span className="font-mono text-[#e7edf6]">narrative.json</span>, <span className="font-mono text-[#e7edf6]">sections.json</span>, <span className="font-mono text-[#e7edf6]">links.json</span>, <span className="font-mono text-[#e7edf6]">seo.json</span>, <span className="font-mono text-[#e7edf6]">appearance.json</span>, <span className="font-mono text-[#e7edf6]">reports/brand-consistency.json</span>, <span className="font-mono text-[#e7edf6]">reports/validation.json</span>, <span className="font-mono text-[#e7edf6]">mapping/phase5-input.json</span>, <span className="font-mono text-[#e7edf6]">manifest.json</span>, and <span className="font-mono text-[#e7edf6]">README.md</span>. Phase 3 artwork is referenced by id. The ZIP does not copy those binaries. Phase 5 readiness lists hard blockers separately from warnings: a blueprint, a name, a ticker, visible section copy, valid links, and replacement conflicts. Unverified claims and unfinished artwork stay warnings. Phase 4 is ready for Phase 5. The website generator remains a contract and has not been started.</p>

      <h2 className="mt-10 text-2xl font-semibold">Known limitations</h2>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-muted">
        <li>GitHub Pages cannot analyze a site, process images, or store an identity profile by itself. Uploads, variants, identity saves, and both ZIP packages need the TokenForge server.</li>
        <li>Content suggestions are rule templates. They are not a language model, and they do not invent partnerships, endorsements, or returns.</li>
        <li>Text inside a bitmap is not read automatically and is not replaced automatically.</li>
        <li>The identity preview is not the Phase 5 website.</li>
        <li>One uploaded mascot does not recreate every pose, expression, or animation.</li>
        <li>Fitted variants are still frames. GIF and video motion is not rebuilt.</li>
        <li>Logins, DRM, paywalls, and bot walls are not bypassed.</li>
        <li>HLS and DASH are not merged into one video.</li>
        <li>One browser task runs at a time. A restart marks a running job interrupted.</li>
        <li>Section roles below a confident landmark are inferred.</li>
        <li>Canvas drawing commands and JavaScript animation sources are not reconstructed.</li>
        <li>Very long pages are capped and marked partial.</li>
      </ul>
    </article>
  );
}
