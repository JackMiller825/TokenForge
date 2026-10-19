const TRACKER_HOSTS = [
  'google-analytics.com',
  'googletagmanager.com',
  'googleadservices.com',
  'googlesyndication.com',
  'doubleclick.net',
  'google-analytics.com',
  'facebook.net',
  'hotjar.com',
  'hotjar.io',
  'segment.io',
  'segment.com',
  'mixpanel.com',
  'sentry.io',
  'clarity.ms',
  'fullstory.com',
  'intercom.io',
  'intercomcdn.com',
  'crisp.chat',
  'tawk.to',
  'newrelic.com',
  'nr-data.net',
  'datadoghq.com',
  'datadoghq.eu',
  'scorecardresearch.com',
  'amazon-adsystem.com',
  'adservice.google.com',
  'cloudflareinsights.com',
  'mouseflow.com',
  'luckyorange.com',
  'optimizely.com',
  'quantserve.com',
  'adnxs.com',
  'taboola.com',
  'outbrain.com',
  'analytics.tiktok.com',
  'mc.yandex.ru',
  'bat.bing.com',
];

function hostMatches(hostname: string, rule: string): boolean {
  return hostname === rule || hostname.endsWith(`.${rule}`);
}

export function isTracker(value: string): boolean {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    if (TRACKER_HOSTS.some((rule) => hostMatches(host, rule))) return true;
    if (hostMatches(host, 'facebook.com') && (url.pathname === '/tr' || url.pathname.startsWith('/tr/'))) return true;
    if (host === 'www.google.com' && url.pathname.startsWith('/pagead')) return true;
    return false;
  } catch {
    return false;
  }
}
