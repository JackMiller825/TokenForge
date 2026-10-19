import Link from 'next/link';

export default function HelpPage() {
  return (
    <main className="relative z-10 mx-auto max-w-3xl px-5 py-10 text-[15px] leading-7">
      <Link href="/" className="text-sm text-lime">Back to the dashboard</Link>
      <p className="mt-8 text-xs font-semibold uppercase tracking-[0.2em] text-lime">Module 01</p>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight">Reference asset downloader</h1>
      <p className="mt-4 text-muted">Enter a public URL, scan the site, review the files TokenForge found, then download a ZIP. The archive keeps original filenames when the URL has them, and marks a name as inferred when it had to be created.</p>

      <h2 className="mt-10 text-2xl font-semibold">Workflow</h2>
      <ol className="mt-3 list-decimal space-y-2 pl-5 text-muted">
        <li>Paste an http or https URL you are allowed to collect from.</li>
        <li>Choose Quick, Deep, or Full scan.</li>
        <li>Watch progress. Cancel if you need to stop.</li>
        <li>Filter, search, and select assets. Open a card for metadata and a safe preview.</li>
        <li>Choose Organized folders or Source paths, then export. Failures stay listed and are written into <span className="font-mono text-[#e7edf6]">manifest.json</span>.</li>
      </ol>

      <h2 className="mt-10 text-2xl font-semibold">Scan modes</h2>
      <ul className="mt-3 space-y-2 text-muted">
        <li><strong className="text-[#e7edf6]">Quick.</strong> The first page only, including a short scroll so lazy-loaded media can appear. About 45 seconds.</li>
        <li><strong className="text-[#e7edf6]">Deep.</strong> Same-origin HTML links, up to 12 pages and depth 3. Defaults are 6 pages and depth 2. About 2 minutes. Paths disallowed by robots.txt are not followed.</li>
        <li><strong className="text-[#e7edf6]">Full.</strong> Scrolling plus a few safe clicks on buttons, tabs, and disclosures. It will not submit forms, connect a wallet, approve a transaction, or buy anything. Defaults are 3 pages and depth 1. About 90 seconds.</li>
      </ul>

      <h2 className="mt-10 text-2xl font-semibold">Filenames</h2>
      <p className="mt-3 text-muted">The basename, including capitalization and Unicode letters, is kept when the URL has one. Unsafe characters and path traversal are removed. <span className="font-mono text-[#e7edf6]">Hero.png</span> and <span className="font-mono text-[#e7edf6]">hero.PNG</span> collide on Windows, so the second becomes <span className="font-mono text-[#e7edf6]">hero__2.PNG</span>. Hashed names such as <span className="font-mono text-[#e7edf6]">a1b2c3d4.png</span> stay hashed. If the URL has no filename, the saved name is <span className="font-mono text-[#e7edf6]">asset-N.ext</span> and <span className="font-mono text-[#e7edf6]">filenameInferred</span> is true. An extension added from the content type is also marked inferred.</p>

      <h2 className="mt-10 text-2xl font-semibold">ZIP layouts</h2>
      <p className="mt-3 text-muted">Organized mode is the default: <span className="font-mono text-[#e7edf6]">images/</span>, <span className="font-mono text-[#e7edf6]">videos/</span>, <span className="font-mono text-[#e7edf6]">fonts/</span>, <span className="font-mono text-[#e7edf6]">audio/</span>, <span className="font-mono text-[#e7edf6]">styles/</span>, <span className="font-mono text-[#e7edf6]">scripts/</span>, <span className="font-mono text-[#e7edf6]">documents/</span>, <span className="font-mono text-[#e7edf6]">other/</span>, plus <span className="font-mono text-[#e7edf6]">manifest.json</span> and <span className="font-mono text-[#e7edf6]">README.md</span>. Source mode keeps a sanitized host and directory path. The preview, the ZIP, and the manifest use the same final path after export.</p>

      <h2 className="mt-10 text-2xl font-semibold">Limits and failures</h2>
      <p className="mt-3 text-muted">Each file can be up to 25 MB. An archive can be up to 160 MB and 250 files. Discovery stops at 700 assets. Downloads use four at a time, retry transient errors with backoff, and time out after 15 seconds. A failed file does not erase the files that succeeded. Export links expire after 15 minutes.</p>

      <h2 className="mt-10 text-2xl font-semibold">Security</h2>
      <p className="mt-3 text-muted">Every page, redirect, and file request must be public http or https on port 80 or 443. Loopback, private, link-local, and metadata addresses are blocked, including after a redirect. The browser is sent through an egress proxy that connects only to an address it has just checked. Set <span className="font-mono text-[#e7edf6]">TOKENFORGE_AUTH_TOKEN</span> before anyone else can reach the server. Previews are images, video, audio, and fonts served with a locked content security policy. Scripts from the target site are never executed in this origin.</p>

      <h2 className="mt-10 text-2xl font-semibold">What this module does not do</h2>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-muted">
        <li>It does not solve captchas, evade bot walls, log into accounts, or bypass DRM and paywalls.</li>
        <li>It does not stitch HLS or DASH streams into one video file.</li>
        <li>GitHub Pages only hosts this interface and the sample library. Scanning needs a Node.js process with Chromium.</li>
        <li>A restart cancels an in-memory scan. This build uses a local job folder, not a separate worker fleet.</li>
        <li>Later modules for analysis, replacement, token identity, site generation, and publishing are interfaces only.</li>
      </ul>
    </main>
  );
}
