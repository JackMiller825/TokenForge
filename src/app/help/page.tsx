import Link from 'next/link';
import { withBase } from '@/lib/format';

export default function HelpPage() {
  return (
    <article className="max-w-3xl text-[15px] leading-7">
      <Link href={withBase('/')} className="text-sm text-lime">Back to the overview</Link>
      <p className="mt-8 text-xs font-semibold uppercase tracking-[0.2em] text-lime">Modules 01 and 02</p>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight">Reference website intelligence</h1>
      <p className="mt-4 text-muted">TokenForge downloads public files and then records how an authorized page is built. The asset scan and the visual analysis stay on one project. A finished download is not the same thing as a finished blueprint.</p>

      <h2 className="mt-10 text-2xl font-semibold">What Phase 2 does</h2>
      <p className="mt-3 text-muted">The website analyzer opens the page in Chromium and writes a blueprint: screenshots, detected sections, observed colors and type, asset positions, and motion it could actually see. It does not invent a design system and it does not recover the site’s source code.</p>

      <h2 className="mt-10 text-2xl font-semibold">Backend connection</h2>
      <p className="mt-3 text-muted">The status control has four states. Connecting means a health check is in progress. Connected means the TokenForge server answered. Unavailable means a backend URL was set and did not answer. Demo mode shows sample projects and a sample blueprint. Demo data is labeled and is not a scan.</p>
      <p className="mt-3 text-muted">GitHub Pages only hosts this interface. Scanning and analysis run on a Node.js server with Chromium. Set the server URL in the status menu, or build the static site with <span className="font-mono text-[#e7edf6]">NEXT_PUBLIC_API_BASE</span>. That value is a public address, not a password. Leave <span className="font-mono text-[#e7edf6]">TOKENFORGE_AUTH_TOKEN</span> on the server and type it into the downloader when the server asks for it.</p>

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

      <h2 className="mt-10 text-2xl font-semibold">Known limitations</h2>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-muted">
        <li>GitHub Pages cannot analyze a site by itself.</li>
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
